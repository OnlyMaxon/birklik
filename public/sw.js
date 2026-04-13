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

  // Для JS модулей - ТОЛЬКО СЕТЬ, без кеша!
  if (request.url.includes('/assets/') && request.url.endsWith('.js')) {
    logRequest(url.pathname, 'JS')
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          // ВАЖНО: проверяем, что это действительно JS, не HTML ошибка
          const mimeType = response.headers.get('content-type') || ''
          if (!isValidMimeType(response, 'application/javascript')) {
            console.error(`[${SW_VERSION}] ⚠️ WRONG MIME for JS! Got: "${mimeType}", Status: ${response.status}, URL: ${url.pathname}`)
            return new Response('Module load error - invalid MIME type', { 
              status: 404,
              headers: { 'Content-Type': 'text/plain' }
            })
          }

          if (response && response.status === 200) {
            console.log(`[${SW_VERSION}] ✓ Valid JS loaded:`, url.pathname)
            // Кешируем ТОЛЬКО валидные JS файлы
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch((err) => {
          console.error(`[${SW_VERSION}] JS fetch failed:`, url.pathname, err.message)
          return caches.match(request).catch((cacheErr) => {
            console.error(`[${SW_VERSION}] No cache available for:`, url.pathname)
            return new Response('', { status: 404 })
          })
        })
    )
    return
  }

  // Для CSS
  if (request.url.includes('/assets/') && request.url.endsWith('.css')) {
    logRequest(url.pathname, 'CSS')
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const mimeType = response.headers.get('content-type') || ''
          if (!isValidMimeType(response, 'text/css')) {
            console.error(`[${SW_VERSION}] ⚠️ WRONG MIME for CSS! Got: "${mimeType}", Status: ${response.status}`)
            return new Response('CSS load error', { status: 404 })
          }

          if (response && response.status === 200) {
            console.log(`[${SW_VERSION}] ✓ Valid CSS loaded:`, url.pathname)
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch((err) => {
          console.warn(`[${SW_VERSION}] CSS fetch failed:`, err.message)
          return caches.match(request).catch(() => {
            return new Response('', { 
              headers: { 'Content-Type': 'text/css' },
              status: 404 
            })
          })
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
