import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { cleanupOrphanedDrafts } from './cleanup/firestore-cleanup';
import { sendPushToUser } from './notifications/sendPush';
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
    const result = await cleanupOrphanedDrafts();
    console.log(`[Cleanup] drafts: ${result.count} deleted`);
    return null;
  });
