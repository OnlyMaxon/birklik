import * as functions from 'firebase-functions/v1';
import {admin} from './firebase-admin';
import {
  cleanupExpiredPremium,
  cleanupOrphanedCancellationRequests,
  cleanupOrphanedDrafts,
  expireStalePayments
} from './cleanup/firestore-cleanup';
import { runAllStorageCleanups } from './cleanup/storage-cleanup';
import { sendPushToUser } from './notifications/send-push';
import { initiatePayment, azericardCallback } from './payment/azericard';

export { initiatePayment, azericardCallback };

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
