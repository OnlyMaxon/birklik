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
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell')
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.log('[SW] Some assets failed to cache, continuing...', err)
      })
    }).then(() => self.skipWaiting())
  )
})

// Активация Service Worker и очистка старого кеша
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('birklik-cache-')) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

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
          // Кешируем успешные ответы
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Если сеть недоступна, возвращаем из кеша
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

  // Для JS модулей - сначала сеть, потом кеш
  if (request.url.includes('/assets/') && (request.url.endsWith('.js') || request.url.endsWith('.css'))) {
    event.respondWith(
      fetch(request)
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
          return caches.match(request).catch(() => {
            // Если файл не в кеше, возвращаем пустой JS
            if (request.url.endsWith('.js')) {
              return new Response('', { 
                headers: { 'Content-Type': 'application/javascript' }
              })
            }
            return new Response('', {
              headers: { 'Content-Type': 'text/css' }
            })
          })
        })
    )
    return
  }

  // Для остального (изображения, шрифты и т.д.) - кеш сначала, потом сеть
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
        }
        return response
      }).catch(() => {
        // Fallback для изображений
        if (request.destination === 'image') {
          return new Response('', { status: 404 })
        }
        throw new Error('No network')
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
