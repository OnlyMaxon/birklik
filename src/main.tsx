import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { LanguageProvider, AuthProvider } from './context'
import './styles/globals.css'

const ua = window.navigator.userAgent
const isIOS = /iPhone|iPad|iPod/i.test(ua)
const isGoogleShell = /GSA|CriOS/i.test(ua)

if (isIOS && isGoogleShell) {
  document.documentElement.classList.add('ios-google')
}

// Обработка ошибок загрузки динамических модулей
let moduleLoadAttempts = 0
const MAX_RELOAD_ATTEMPTS = 0 // Отключено - Service Worker теперь работает правильно

window.addEventListener('error', (event: ErrorEvent) => {
  if (event.message && event.message.includes('Failed to fetch dynamically imported module')) {
    moduleLoadAttempts++
    console.error(`[App] ⚠️ Module load error (attempt ${moduleLoadAttempts}/${MAX_RELOAD_ATTEMPTS}):`, event.error)
    console.error('[App] This should not happen - Service Worker is working correctly!')
    
    if (moduleLoadAttempts < MAX_RELOAD_ATTEMPTS) {
      console.log('[App] Clearing cache and reloading...')
      // Очищаем ALL кеши
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          Promise.all(cacheNames.map((cacheName) => {
            console.log('[App] Clearing cache:', cacheName)
            return caches.delete(cacheName)
          })).then(() => {
            console.log('[App] Cache cleared, reloading...')
            // Перезагружаем страницу с параметром для обновления
            const url = new URL(globalThis.location.href)
            url.searchParams.set('t', Date.now().toString())
            url.searchParams.set('attempt', moduleLoadAttempts.toString())
            globalThis.location.href = url.toString()
          })
        })
      }
    } else {
      console.error('[App] Max reload attempts reached!')
      alert('Ошибка загрузки приложения. Пожалуйста, обновите страницу браузером.')
    }
  }
})

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Добавляем версию/checksum для cache-busting
    const swVersion = '2026-04-14-v4'
    const swUrl = `/sw.js?v=${swVersion}`
    
    navigator.serviceWorker.register(swUrl, { scope: '/' })
      .then((registration) => {
        console.log('[App] Service Worker registered successfully')
        // Проверяем обновления каждые 10 минут
        setInterval(() => {
          registration.update()
        }, 10 * 60 * 1000)
      })
      .catch((error) => {
        console.error('[App] Service Worker registration failed:', error)
      })
    
    // Слушаем обновления Service Worker
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // SW обновился и загрузил новую версию
    })

    // Слушаем сообщения от Service Worker
    navigator.serviceWorker.addEventListener('message', (_event) => {
      // Обработка сообщений от SW
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
