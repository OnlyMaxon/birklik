import { useEffect } from 'react'
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db, getFirebaseMessaging } from '../lib/firebase/client'
import { useAuth } from '@/components/providers'

// Только веб-пуши. Нативная ветка через @capacitor/push-notifications удалена
// вместе с обёрткой Android: мобильное приложение переезжает на Expo и будет
// жить отдельным репозиторием со своей регистрацией токенов.
//
// Токены, записанные прежним Android-приложением, остаются в users.fcmTokens и
// протухнут сами: sendPushToUser удаляет их, как только FCM ответит
// registration-token-not-registered.
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

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

    // Воркер регистрирует AppClientEffects; здесь дожидаемся готовности той же
    // регистрации — своей у пушей нет, public/sw.js существует ровно ради них.
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

export function usePushNotifications() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return
    setupWebPush(user.id)
  }, [user?.id])
}
