import { useEffect } from 'react'
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db, getFirebaseMessaging } from '../config/firebase'
import { useAuth } from '../context'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Detect native Capacitor environment
const isNative = () =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor?.isNativePlatform?.()

async function saveToken(userId: string, token: string) {
  const userRef = doc(db, 'users', userId)
  const snap = await getDoc(userRef)
  const existing: string[] = snap.data()?.fcmTokens || []
  if (!existing.includes(token)) {
    await updateDoc(userRef, { fcmTokens: arrayUnion(token) })
  }
}

async function setupWebPush(userId: string) {
  if (!VAPID_KEY) return
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return
  if (Notification.permission === 'denied') return

  try {
    const { getToken, isSupported } = await import('firebase/messaging')

    const supported = await isSupported()
    if (!supported) return

    const messaging = await getFirebaseMessaging()
    if (!messaging) return

    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (token) await saveToken(userId, token)
  } catch {
    // Permission denied or unsupported — silent
  }
}

async function setupNativePush(userId: string) {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permResult = await PushNotifications.requestPermissions()
    if (permResult.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async ({ value: token }) => {
      await saveToken(userId, token)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data
      if (!data?.type) return

      let url = '/'
      if (data.type === 'booking') url = '/dashboard?tab=bookings&subtab=requests'
      else if (data.type === 'bookingApproved' || data.type === 'bookingRejected')
        url = '/dashboard?tab=bookings&subtab=my-bookings'
      else if (['comment', 'reply', 'favorite', 'rating'].includes(data.type) && data.propertyId)
        url = `/property/${data.propertyId}`

      window.location.href = url
    })
  } catch {
    // Native push not available — silent
  }
}

export function usePushNotifications() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    if (isNative()) {
      setupNativePush(user.id)
    } else {
      setupWebPush(user.id)
    }
  }, [user?.id])
}
