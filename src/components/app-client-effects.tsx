'use client'

import {useEffect} from 'react'
import {usePushNotifications} from '@/hooks'

export function AppClientEffects() {
  usePushNotifications()

  useEffect(() => {
    const ua = window.navigator.userAgent
    if (/iPhone|iPad|iPod/i.test(ua) && /GSA|CriOS/i.test(ua)) {
      document.documentElement.classList.add('ios-google')
    }

    // Регистрация нужна ровно ради пуш-уведомлений: без неё браузер не выдаёт
    // push-подписку и getToken в usePushNotifications вернёт пустоту. Офлайн-кэш
    // и прочая обвязка PWA из воркера убраны — см. public/sw.js.
    if (!('serviceWorker' in navigator)) return
    let timer: number | undefined
    const register = () => {
      void navigator.serviceWorker.register('/sw.js?v=2026-09-03-push', {scope: '/'})
        .then(registration => {
          timer = window.setInterval(() => void registration.update(), 10 * 60 * 1000)
        })
        .catch(() => undefined)
    }
    window.addEventListener('load', register)
    return () => {
      window.removeEventListener('load', register)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [])

  return null
}
