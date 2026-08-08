import * as functions from 'firebase-functions/v1';
import {admin} from './firebase-admin';
import { cleanupOrphanedDrafts, expireStalePayments, logCleanupResult } from './cleanup/firestore-cleanup';
import { runAllStorageCleanups } from './cleanup/storage-cleanup';
import { sendPushToUser } from './notifications/send-push';
import { initiatePayment, azericardCallback, performReversal } from './payment/azericard';

export { initiatePayment, azericardCallback, performReversal };

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
    console.log(`[Cleanup] stale payments: ${expired.count} expired`);
    await logCleanupResult(expired);

    const result = await cleanupOrphanedDrafts();
    console.log(`[Cleanup] drafts: ${result.count} deleted`);
    await logCleanupResult(result);
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
