// Service Worker для управления кешем и обновлением приложения

const CACHE_VERSION = 'v1-' + new Date().getTime()
const CACHE_NAME = 'birklik-cache-' + CACHE_VERSION

// Файлы для кеширования при первой загрузке
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Установка Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Some assets may fail to cache - that's OK, they'll be cached on demand
      })
    }).then(() => self.skipWaiting())
  )
})

// Активация Service Worker и очистка старого кеша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('birklik-cache-')) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Проверка MIME типа
function isValidMimeType(response, expectedType) {
  if (!response) return false
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes(expectedType)
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
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Если 404, попробуем загрузить index.html для SPA routing
          if (response.status === 404) {
            // Это может быть SPA маршрут - загружаем index.html
            return fetch('/index.html')
              .then((indexResponse) => {
                if (indexResponse && indexResponse.status === 200) {
                  // Кешируем index.html
                  const responseToCache = indexResponse.clone()
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache)
                  })
                  // Возвращаем с оригинальным URL чтобы браузер обновил историю
                  return new Response(indexResponse.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: indexResponse.headers
                  })
                }
                return response
              })
              .catch(() => response)
          }

          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
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
    event.respondWith(
      fetch(request, { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => {
          const mimeType = response.headers.get('content-type') || ''
          const isValidJS = mimeType.includes('application/javascript') || mimeType.includes('application/x-javascript')
          
          if (response.status !== 200) {
            console.error('[SW] JS fetch error:', url.pathname, response.status)
            return new Response(`Error: ${response.status}`, { status: response.status })
          }

          if (!isValidJS) {
            console.error('[SW] Wrong MIME for JS:', mimeType, url.pathname)
            return new Response('Wrong MIME type', { status: 502 })
          }

          return response
        })
        .catch((err) => {
          console.error('[SW] JS fetch failed:', url.pathname)
          return new Response(`Fetch failed: ${err.message}`, { status: 503 })
        })
    )
    return
  }

  // Для CSS - тоже ТОЛЬКО СЕТЬ
  if (request.url.includes('/assets/') && request.url.endsWith('.css')) {
    event.respondWith(
      fetch(request, { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => {
          const mimeType = response.headers.get('content-type') || ''
          const isValidCSS = mimeType.includes('text/css')
          
          if (response.status !== 200) {
            return new Response(`Error: ${response.status}`, { status: response.status })
          }

          if (!isValidCSS) {
            console.error('[SW] Wrong MIME for CSS:', mimeType)
            return new Response('Wrong MIME type', { status: 502 })
          }

          return response
        })
        .catch(() => {
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
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('', { status: 404 })
        })
      })
  )
})

// Сообщения от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
