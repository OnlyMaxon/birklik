import {admin} from '../firebase-admin'

interface PushPayload {
  type: string
  title: string
  message: string
  propertyId?: string
  bookingId?: string
}

/**
 * Sends an FCM push notification to all registered devices of a user.
 * Automatically removes invalid/expired tokens from Firestore.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const userSnap = await admin.firestore().doc(`users/${userId}`).get()
    if (!userSnap.exists) return

    const fcmTokens: string[] = userSnap.data()?.fcmTokens || []
    if (fcmTokens.length === 0) return

    const invalidTokens: string[] = []

    await Promise.all(
      fcmTokens.map(async (token) => {
        try {
          await admin.messaging().send({
            token,
            // data-only push — sw.js handles showing the notification
            data: {
              type: payload.type,
              title: payload.title,
              body: payload.message,
              propertyId: payload.propertyId || '',
              bookingId: payload.bookingId || '',
            },
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                title: payload.title,
                body: payload.message,
                icon: 'https://birklik.az/brand/generated/logo-192x192.png',
                badge: 'https://birklik.az/brand/generated/logo-96x96.png',
                tag: payload.type,
                renotify: true,
              },
              data: {
                type: payload.type,
                propertyId: payload.propertyId || '',
                bookingId: payload.bookingId || '',
              },
            },
          })
        } catch (err: any) {
          const invalidCodes = [
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
            'messaging/invalid-argument',
          ]
          if (invalidCodes.includes(err.code)) {
            invalidTokens.push(token)
          } else {
            console.error(`[FCM] Send failed for token ${token.slice(0, 10)}...:`, err.code)
          }
        }
      })
    )

    // Clean up stale tokens
    if (invalidTokens.length > 0) {
      await admin.firestore().doc(`users/${userId}`).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      })
      console.log(`[FCM] Removed ${invalidTokens.length} invalid token(s) for user ${userId}`)
    }
  } catch (err) {
    console.error('[FCM] sendPushToUser failed:', err)
  }
}
