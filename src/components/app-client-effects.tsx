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

    if (!('serviceWorker' in navigator)) return
    const register = () => {
      void navigator.serviceWorker.register('/sw.js?v=2026-04-14-v4', {scope: '/'})
        .then(registration => {
          const interval = window.setInterval(() => void registration.update(), 10 * 60 * 1000)
          return () => window.clearInterval(interval)
        })
        .catch(() => undefined)
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
