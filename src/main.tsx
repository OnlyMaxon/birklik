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
const MAX_RELOAD_ATTEMPTS = 3

window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Failed to fetch dynamically imported module')) {
    moduleLoadAttempts++
    console.error(`[App] Module load failed (attempt ${moduleLoadAttempts}):`, event.error)
    
    if (moduleLoadAttempts < MAX_RELOAD_ATTEMPTS) {
      // Очищаем все кеши
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          cacheNames.forEach((cacheName) => {
            caches.delete(cacheName)
          })
        })
      }
      // Перезагружаем страницу с параметром для обновления
      const url = new URL(window.location.href)
      url.searchParams.set('t', Date.now().toString())
      window.location.href = url.toString()
    }
  }
})

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[App] Service Worker registered successfully:', registration)
        
        // Проверяем обновления каждые 30 минут
        setInterval(() => {
          registration.update()
        }, 30 * 60 * 1000)
      })
      .catch((error) => {
        console.warn('[App] Service Worker registration failed:', error)
      })
    
    // Слушаем обновления Service Worker
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[App] Service Worker controller changed, reload may be needed')
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
