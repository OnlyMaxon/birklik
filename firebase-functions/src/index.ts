import * as functions from 'firebase-functions/v1';
import {admin} from './firebase-admin';
import {
  cleanupExpiredPremium,
  cleanupOrphanedCancellationRequests,
  cleanupOrphanedDrafts,
  expireStalePayments
} from './cleanup/firestore-cleanup';
import { runAllStorageCleanups } from './cleanup/storage-cleanup';
import { runDailyBoosts } from './boost/daily-boosts';
import { sendPushToUser } from './notifications/send-push';
import { initiatePayment, azericardCallback } from './payment/azericard';
import { verifyPlayPurchase } from './payment/verify-play-purchase';
import { syncVoidedPurchases } from './payment/voided-purchases';
import { deleteAccount } from './account/delete-account';

export { initiatePayment, azericardCallback, verifyPlayPurchase, deleteAccount };

admin.initializeApp();

export const onNotificationCreated = functions
  .region('europe-west1')
  .firestore.document('users/{userId}/notifications/{notifId}')
  .onCreate(async (snap, context) => {
    const { userId } = context.params;
    const data = snap.data();

    if (!data) return null;

    await sendPushToUser(userId, {
      type: data.type || 'general',
      title: data.title || 'Birklik.az',
      message: data.message || '',
      propertyId: data.relatedId || '',
      bookingId: data.bookingId || '',
    });

    return null;
  });

export const cleanupDrafts = functions
  .region('europe-west1')
  .pubsub.schedule('every 2 hours')
  .timeZone('UTC')
  .onRun(async () => {
    // Сначала гасим протухшие платежи: пока платёж висит в awaiting_payment,
    // привязанный к нему драфт для чистки неприкосновенен.
    const expired = await expireStalePayments();
    console.log(`[Cleanup] stale payments: ${expired.count} expired`, expired.deletedIds);

    const result = await cleanupOrphanedDrafts();
    console.log(`[Cleanup] drafts: ${result.count} deleted`, result.deletedIds);
    return null;
  });

/**
 * Ежедневно убирает с витрины объявления с истёкшим VIP/Premium: status → inactive,
 * expiredAt = now.
 *
 * Раньше `cleanupExpiredPremium` была написана, но не запланирована — дотянуться до
 * неё можно было только вручную через `pnpm cleanup:execute`. Из-за этого истечение
 * платного тарифа не значило ничего: объявление оставалось `active` и висело в
 * выдаче наравне с оплаченными.
 *
 * Ничего не удаляет. Объявление с фотографиями остаётся в базе, продление возвращает
 * его на витрину.
 */
export const expirePaidTiers = functions
  .region('europe-west1')
  .pubsub.schedule('every day 03:00')
  .timeZone('UTC')
  .onRun(async () => {
    const result = await cleanupExpiredPremium();
    console.log(`[Expiry] скрыто объявлений: ${result.count}`, result.deletedIds);
    return null;
  });

/**
 * Ежедневно расходует пакеты подъёма: по одному подъёму в сутки на объявление,
 * пока счётчик не кончится. Закончившийся пакет удаляется сам.
 *
 * 01:00 UTC — это 05:00 в Баку. Выбрано намеренно: подъём должен случиться ДО
 * того, как люди начнут смотреть объявления, иначе купленные сутки наверху
 * начинались бы с пустого ночного часа.
 *
 * ⚠️ Расписание — не единственный способ попасть в эту задачу: планировщик
 * повторяет вызов при ошибке функции. Защита от двойного расхода стоит внутри
 * `runDailyBoosts` (`MIN_HOURS_BETWEEN_BUMPS`), а не здесь.
 */
export const dailyBoosts = functions
  .region('europe-west1')
  .pubsub.schedule('every day 01:00')
  .timeZone('UTC')
  .onRun(async () => {
    const result = await runDailyBoosts();
    console.log(
      `[Boost] поднято: ${result.bumped}, закончилось пакетов: ${result.finished}, ` +
      `пропущено: ${result.skipped}, убрано записей: ${result.removed}`
    );
    return null;
  });

/**
 * Ежедневно сверяет возвраты Google Play и забирает оплаченное обратно.
 *
 * ⚠️ Без этой задачи возврат денег НЕ снимал тариф: Google про возврат не
 * сообщает ничем, покупка просто перестаёт быть действительной, а тариф у нас
 * уже стоит. То есть человек возвращал деньги и оставлял себе оплаченное. Убыток
 * тихий — покупатель доволен, жалоб нет, в журнале порядок, — и потому не
 * замеченный с самого появления покупок в приложении. Закрыто 2026-10-15.
 *
 * 02:00 UTC — между подъёмом (01:00) и истечением тарифов (03:00): к моменту,
 * когда `expirePaidTiers` считает сроки, возвраты уже забраны.
 *
 * ⚠️ Прогон смотрит на неделю назад, хотя и запускается ежедневно. Повтор
 * безопасен (отметка `voided` на записи чека), а пропущенный прогон иначе
 * означал бы безвозвратно пропущенный возврат: Google хранит такие записи около
 * тридцати дней.
 */
export const syncPlayRefunds = functions
  .region('europe-west1')
  .pubsub.schedule('every day 02:00')
  .timeZone('UTC')
  .onRun(async () => {
    try {
      const result = await syncVoidedPurchases();
      console.log(
        `[Voided] получено: ${result.seen}, отозвано: ${result.revoked}, ` +
        `уже разобрано: ${result.known}, неизвестных: ${result.unknown}`
      );
    } catch (error) {
      // Отказ Google не должен ронять расписание: следующий прогон посмотрит на
      // ту же неделю назад и догонит пропущенное.
      console.error('[Voided] Сверка возвратов не удалась:', error);
    }
    return null;
  });

/**
 * Еженедельно убирает запросы на отмену, чья бронь больше не существует.
 *
 * Основную дыру закрыли в приложении — `deleteBooking` удаляет запрос вместе с
 * бронью. Это сеть под ней: брони пропадают и мимо приложения, вместе с
 * удалённым объявлением или правкой руками в консоли.
 */
export const cleanupStaleRequests = functions
  .region('europe-west1')
  .pubsub.schedule('every sunday 05:00')
  .timeZone('UTC')
  .onRun(async () => {
    const result = await cleanupOrphanedCancellationRequests();
    console.log(`[Cleanup] запросы на отмену без брони: ${result.count}`);
    return null;
  });

/**
 * Еженедельная чистка Storage: осиротевшие фото объявлений, temp/ и старые аватары.
 * Раньше runAllStorageCleanups вызывался только вручную из cleanup:execute, а его
 * никто не запускал — за два месяца накопилось 92 МБ мусора.
 * Ручной разбор завалов остаётся в src/cleanup/storage-orphans.ts.
 */
export const cleanupStorage = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every sunday 04:00')
  .timeZone('UTC')
  .onRun(async () => {
    const results = await runAllStorageCleanups();
    console.log('[Cleanup] storage:', results.map((r) => `${r.type}:${r.count}`).join(', '));
    return null;
  });
