// Service Worker для управления кешем и обновлением приложения
// CRITICAL: All assets are served directly from network/browser cache
// Service Worker only handles HTML for offline support and SPA routing

const STATIC_CACHE_VERSION = 'v1-2026-04-23'
const CACHE_NAME = 'birklik-html-' + STATIC_CACHE_VERSION

// Install event - minimal setup
self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old cache versions
          if (cacheName.startsWith('birklik-html-') && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - CRITICAL STRATEGY
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // === HTML STRATEGY ===
  // Network first, fallback to cache, then offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          // If successful, cache it
          if (response && response.status === 200) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Network failed - try cache
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html').then((indexResponse) => {
              return indexResponse || new Response('Offline - no cached page', {
                status: 503,
                statusText: 'Service Unavailable'
              })
            })
          })
        })
    )
    return
  }

  // === JAVASCRIPT/CSS/ASSETS STRATEGY ===
  // Let browser cache handle these - NO Service Worker caching
  // Just pass through to network/browser cache
  if (request.url.includes('/assets/')) {
    event.respondWith(
      fetch(request, { cache: 'default', credentials: 'same-origin' })
        .catch(() => {
          // If network fails, try browser cache
          return caches.match(request).then((cached) => {
            return cached || new Response('Asset not available', { status: 503 })
          })
        })
    )
    return
  }

  // === OTHER RESOURCES (images, fonts, etc.) ===
  event.respondWith(
    fetch(request, { cache: 'default' })
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
          return cached || new Response('Resource not available', { status: 503 })
        })
      })
  )
})

// Message handler for client updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Notification click handler - обработка клика на push-уведомления
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  // Получаем тип уведомления из data
  const notificationType = event.notification.data?.type
  const propertyId = event.notification.data?.propertyId
  
  let targetUrl = '/'
  
  // Определяем URL в зависимости от типа уведомления
  if (notificationType === 'booking') {
    // Запрос на бронирование - открыть вкладку "Запросы на бронирование"
    targetUrl = '/dashboard?tab=bookings&subtab=requests'
  } else if (notificationType === 'bookingApproved' || notificationType === 'bookingRejected') {
    // Одобрение/отклонение бронирования - открыть "Мои бронирования"
    targetUrl = '/dashboard?tab=bookings&subtab=my-bookings'
  } else if (notificationType === 'comment' || notificationType === 'reply') {
    // Комментарий - открыть страницу свойства
    targetUrl = propertyId ? `/property/${propertyId}` : '/'
  } else if (notificationType === 'favorite') {
    // Добавление в избранное - открыть страницу свойства
    targetUrl = propertyId ? `/property/${propertyId}` : '/'
  } else if (notificationType === 'rating') {
    // Оценка - открыть страницу свойства
    targetUrl = propertyId ? `/property/${propertyId}` : '/'
  }
  
  // Открываем окно с правильным URL
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Проверяем, есть ли уже открытое окно приложения
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === '/' || client.url.includes('birklik')) {
          // Если окно уже открыто, просто фокусируем его и обновляем URL
          return client.focus().then(() => {
            client.navigate(targetUrl)
          })
        }
      }
      // Если окна нет, открываем новое
      return clients.openWindow(targetUrl)
    })
  )
})
