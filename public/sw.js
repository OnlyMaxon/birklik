// Service Worker для управления кешем и обновлением приложения

const CACHE_VERSION = 'v1-' + new Date().getTime()
const CACHE_NAME = 'birklik-cache-' + CACHE_VERSION
const SW_VERSION = 'SW-' + CACHE_VERSION

// Файлы для кеширования при первой загрузке
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log(`[${SW_VERSION}] Installing service worker...`)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`[${SW_VERSION}] Caching app shell`)
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.log(`[${SW_VERSION}] Some assets failed to cache, continuing...`, err)
      })
    }).then(() => self.skipWaiting())
  )
})

// Активация Service Worker и очистка старого кеша
self.addEventListener('activate', (event) => {
  console.log(`[${SW_VERSION}] Activating service worker...`)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log(`[${SW_VERSION}] Found caches:`, cacheNames)
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('birklik-cache-')) {
            console.log(`[${SW_VERSION}] Deleting old cache:`, cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      console.log(`[${SW_VERSION}] Claiming clients...`)
      return self.clients.claim()
    })
  )
})

// Проверка MIME типа
function isValidMimeType(response, expectedType) {
  if (!response) return false
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes(expectedType)
}

// Логирование информации о запросе
function logRequest(url, type) {
  console.log(`[${SW_VERSION}] Fetch ${type}:`, url)
}

// Перехват fetch запросов
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Пропускаем не-GET запросы
  if (request.method !== 'GET') {
    return
  }

  // Для HTML - сетевая стратегия с fallback на кеш
  if (request.headers.get('accept')?.includes('text/html')) {
    logRequest(url.pathname, 'HTML')
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Проверяем MIME тип
          if (!isValidMimeType(response, 'text/html') && response.status !== 200) {
            console.warn(`[${SW_VERSION}] Non-200 HTML response:`, response.status)
            return response
          }

          if (response && response.status === 200) {
            console.log(`[${SW_VERSION}] Caching HTML:`, url.pathname)
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch((err) => {
          console.warn(`[${SW_VERSION}] HTML fetch failed:`, err.message)
          return caches.match(request).then((response) => {
            return response || new Response('Offline - no cached version', {
              status: 503,
              statusText: 'Service Unavailable'
            })
          })
        })
    )
    return
  }

  // Для JS модулей - ТОЛЬКО СЕТЬ, БЕЗ КЕША!
  if (request.url.includes('/assets/') && request.url.endsWith('.js')) {
    logRequest(url.pathname, 'JS - NETWORK ONLY')
    event.respondWith(
      fetch(request, { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => {
          const mimeType = response.headers.get('content-type') || ''
          const isValidJS = mimeType.includes('application/javascript') || mimeType.includes('application/x-javascript')
          
          console.log(`[${SW_VERSION}] JS Response: status=${response.status}, mime="${mimeType}", valid=${isValidJS}`)
          
          // Если статус не 200, это ошибка
          if (response.status !== 200) {
            console.error(`[${SW_VERSION}] ❌ Non-200 JS response: ${response.status} ${mimeType}`)
            return new Response(`Error: ${response.status}`, { 
              status: response.status,
              headers: { 'Content-Type': 'text/plain' }
            })
          }

          // Если MIME неправильный даже при 200
          if (!isValidJS) {
            console.error(`[${SW_VERSION}] ❌ Wrong MIME type! Expected JS but got: "${mimeType}" for ${url.pathname}`)
            return new Response('Wrong MIME type', { 
              status: 502,
              headers: { 'Content-Type': 'text/plain' }
            })
          }

          console.log(`[${SW_VERSION}] ✅ Valid JS: ${url.pathname}`)
          return response
        })
        .catch((err) => {
          console.error(`[${SW_VERSION}] ❌ JS Fetch error:`, url.pathname, err.message)
          return new Response(`Fetch failed: ${err.message}`, { 
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          })
        })
    )
    return
  }

  // Для CSS - тоже ТОЛЬКО СЕТЬ
  if (request.url.includes('/assets/') && request.url.endsWith('.css')) {
    logRequest(url.pathname, 'CSS - NETWORK ONLY')
    event.respondWith(
      fetch(request, { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => {
          const mimeType = response.headers.get('content-type') || ''
          const isValidCSS = mimeType.includes('text/css')
          
          if (response.status !== 200) {
            console.error(`[${SW_VERSION}] ❌ Non-200 CSS response: ${response.status}`)
            return new Response(`Error: ${response.status}`, { status: response.status })
          }

          if (!isValidCSS) {
            console.error(`[${SW_VERSION}] ❌ Wrong MIME for CSS: "${mimeType}"`)
            return new Response('Wrong MIME type', { status: 502 })
          }

          console.log(`[${SW_VERSION}] ✅ Valid CSS: ${url.pathname}`)
          return response
        })
        .catch((err) => {
          console.error(`[${SW_VERSION}] ❌ CSS Fetch error:`, url.pathname)
          return new Response(`Fetch failed`, { status: 503 })
        })
    )
    return
  }

  // Для остального (изображения, шрифты и т.д.) - сеть сначала
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
        }
        return response
      })
      .catch((err) => {
        console.warn(`[${SW_VERSION}] Asset fetch failed:`, url.pathname)
        return caches.match(request).catch(() => {
          return new Response('', { status: 404 })
        })
      })
  )
})

// Сообщения от клиента
self.addEventListener('message', (event) => {
  console.log(`[${SW_VERSION}] Message received:`, event.data)
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log(`[${SW_VERSION}] SKIP_WAITING - installing new version`)
    self.skipWaiting()
  }
})
