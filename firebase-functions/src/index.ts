import * as functions from 'firebase-functions/v1';
import {admin} from './firebase-admin';
import {
  cleanupExpiredPremium,
  cleanupExpiredClientErrors,
  cleanupOrphanedCancellationRequests,
  cleanupOrphanedDrafts,
  expireStalePayments
} from './cleanup/firestore-cleanup';
import { runAllStorageCleanups } from './cleanup/storage-cleanup';
import { runDailyBoosts } from './boost/daily-boosts';
import { sendPushToUser } from './notifications/send-push';
import { initiatePayment, azericardCallback } from './payment/azericard';
import { verifyPlayPurchase } from './payment/verify-play-purchase';
import { verifyApplePurchase } from './payment/verify-apple-purchase';
import { appleNotifications } from './payment/apple-notifications';
import { syncVoidedPurchases } from './payment/voided-purchases';
import { syncAppleRefunds } from './payment/apple-refund-sync';
import { auditTierChange } from './moderation/tier-audit';
import { deleteAccount } from './account/delete-account';
import { setUserBlocked } from './moderation/block-user';
import { notifyBookingCreated } from './notifications/booking-created';
import { recordPaymentRevenue, recordRefundRevenue } from './revenue/record-revenue';
import { reportClientError } from './diagnostics/report-client-error';

export {
  initiatePayment,
  azericardCallback,
  verifyPlayPurchase,
  verifyApplePurchase,
  appleNotifications,
  deleteAccount,
  setUserBlocked,
  // Единственное место, куда клиент может рассказать, чем кончилась подача
  // объявления: в базу она пишется напрямую с устройства, и логировать её
  // больше нечем. Разбор, из-за которого функция появилась, — в её шапке.
  reportClientError,
};

admin.initializeApp();

/**
 * Журналирует изменения тарифа и подъёма — чьи угодно.
 *
 * ⚠️ Решение владельца 2026-10-15: правки тарифа модератором должны
 * журналироваться. Сделано триггером, а не записью из браузера, намеренно:
 * правку через консоль Firebase браузерный журнал не увидел бы никогда — а
 * именно такая у нас и случилась 31 августа, когда поля тарифа у одного
 * объявления исчезли целиком.
 *
 * ⚠️ Функция зовётся на КАЖДУЮ правку объявления, и это осознанная цена. Чтобы
 * она была минимальной, `auditTierChange` начинает со сравнения пяти полей и на
 * обычной правке текста или фотографий заканчивает работу там же — без единого
 * запроса в базу.
 *
 * Отказ журнала НЕ должен ронять правку: объявление уже записано, триггер идёт
 * после. Поэтому ошибка только пишется в журнал функций.
 */
export const auditTierChanges = functions
  .region('europe-west1')
  .firestore.document('properties/{propertyId}')
  .onUpdate(async (change, context) => {
    try {
      await auditTierChange({
        propertyId: context.params.propertyId,
        before: change.before.data() ?? {},
        after: change.after.data() ?? {},
      });
    } catch (error) {
      console.error('[TierAudit] Не удалось записать изменение:', error);
    }
    return null;
  });

/**
 * Считает выручку по журналу платежей.
 *
 * ⚠️ Стоит на `onWrite`, а не на `onCreate`, потому что у двух касс платёж
 * попадает в журнал по-разному: Apple и Google кладут сразу `completed`, а
 * банк сначала `awaiting_payment` и лишь потом, в колбэке, `completed`. Один
 * `onCreate` пропустил бы ВСЮ выручку банка — то есть ровно ту, что идёт
 * манатами и сверяется с выпиской.
 *
 * Отказ счётчика не должен ронять платёж: деньги уже взяты, объявление уже
 * поднято, и бросок здесь только заставил бы Google повторять доставку. Поэтому
 * ошибка пишется в журнал функций и на этом всё.
 */
export const recordRevenue = functions
  .region('europe-west1')
  .firestore.document('payments/{paymentId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null;

    try {
      await recordPaymentRevenue(context.params.paymentId, after);
      await recordRefundRevenue(context.params.paymentId, after);
    } catch (error) {
      console.error('[Revenue] Не удалось учесть платёж:', context.params.paymentId, error);
    }
    return null;
  });

/**
 * Рассылает уведомление о новой брони: владельцу объявления и всем модераторам.
 *
 * ⚠️ Триггером, а не с клиента, и причин две. Первая: список модераторов
 * обычному гостю недоступен правилами, и это правильно. Вторая: до 2026-11-12
 * уведомление владельцу слал только сайт, а бронь из приложения не доходила до
 * него вовсе — здесь это лечится для обеих площадок разом.
 */
export const onBookingCreated = functions
  .region('europe-west1')
  .firestore.document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    try {
      await notifyBookingCreated(context.params.bookingId, snap.data() ?? {});
    } catch (error) {
      console.error('[Booking] Не удалось разослать уведомления:', context.params.bookingId, error);
    }
    return null;
  });

export const onNotificationCreated = functions
  .region('europe-west1')
  .firestore.document('users/{userId}/notifications/{notifId}')
  .onCreate(async (snap, context) => {
    const { userId } = context.params;
    const data = snap.data();

    if (!data) return null;

    // Какой канал, то есть какой звук. Решение владельца 2026-11-22: бронь и
    // присмотр модератора должны звучать по-разному, потому что это разные дела.
    //
    // ⚠️ Отличает их `forModerator`, а НЕ тип: тип у обоих уведомлений один
    // (`booking`) намеренно — экран уведомлений умеет показывать именно его, и
    // заводить второй вид значило бы править разбор в двух приложениях сразу.
    //
    // ⚠️ Остальные уведомления канала НЕ получают и остаются на резервном со
    // системным звуком. Это не забывчивость: своих звуков для них никто не
    // выбирал, а свалить их в канал «Rezervasiyalar» значило бы соврать
    // человеку в системных настройках телефона.
    const channel =
      data.type === 'booking' ? (data.forModerator === true ? 'moderation' : 'booking') : undefined;

    await sendPushToUser(userId, {
      type: data.type || 'general',
      title: data.title || 'Birklik.az',
      message: data.message || '',
      propertyId: data.relatedId || '',
      bookingId: data.bookingId || '',
      ...(channel ? { channel } : {}),
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
 * Ночной опрос возвратов App Store — второй рубеж к уведомлениям.
 *
 * ⚠️ Отдельной задачей от `syncPlayRefunds`, а не веткой внутри неё: кассы
 * разные, ключи разные, и отказ одного магазина не должен мешать разбору
 * другого. Время сдвинуто на полчаса, чтобы две задачи не будили друг друга.
 *
 * Без ключа In-App Purchase задача честно пишет об этом и выходит — расписание
 * при этом остаётся целым.
 */
export const syncAppleRefundsDaily = functions
  .region('europe-west1')
  // ⚠️ Секреты объявляются ЗДЕСЬ, как у Azericard, и подключаются только к той
  // функции, которой нужны. Выкладка их не стирает: хранит их Secret Manager,
  // а код лишь называет. Никаких `.env` в проекте нет и не нужно.
  .runWith({
    timeoutSeconds: 540,
    secrets: ['APPLE_ISSUER_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
  })
  .pubsub.schedule('every day 02:30')
  .timeZone('UTC')
  .onRun(async () => {
    try {
      await syncAppleRefunds();
    } catch (error) {
      // Отказ Apple не должен ронять расписание: следующий прогон посмотрит на
      // ту же неделю назад и догонит пропущенное.
      console.error('[AppleSync] Сверка возвратов не удалась:', error);
    }
    return null;
  });

/**
 * Еженедельная уборка мелких коллекций базы.
 *
 * Запросы на отмену, чья бронь больше не существует: основную дыру закрыли в
 * приложении — `deleteBooking` удаляет запрос вместе с бронью. Это сеть под ней:
 * брони пропадают и мимо приложения, вместе с удалённым объявлением или правкой
 * руками в консоли.
 *
 * Донесения об ошибках с истёкшим сроком — вместо политики TTL самой Firestore.
 * ⚠️ Она включается ТОЛЬКО руками в консоли, кодом её не выразить и выкладкой не
 * поставить, а поле `expiresAt` без неё просто дата в документе и ничего не
 * удаляет. Решение владельца 2026-11-23: делать кодом, чтобы выкладывалось
 * командой и не забывалось. Сюда, а не в `cleanupStorage`: донесения лежат в
 * Firestore, а та ходит по хранилищу.
 */
export const cleanupStaleRequests = functions
  .region('europe-west1')
  .pubsub.schedule('every sunday 05:00')
  .timeZone('UTC')
  .onRun(async () => {
    const stale = await cleanupOrphanedCancellationRequests();
    const reports = await cleanupExpiredClientErrors();
    console.log(
      `[Cleanup] запросы на отмену без брони: ${stale.count}, донесений просроченных: ${reports.count}`
    );
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
