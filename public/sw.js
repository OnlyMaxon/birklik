// Воркер оставлен ТОЛЬКО ради пуш-уведомлений: без регистрации Service Worker
// браузер не выдаёт push-подписку, а значит getToken в use-push-notifications.ts
// не сработает. Всё остальное — офлайн-кэш, перехват fetch, манифест, установка
// на домашний экран — удалено вместе с идеей PWA.
//
// Обработчик activate чистит кэши birklik-html-*, оставшиеся у тех, кто заходил
// на сайт со старой версией воркера. Удалять этот блок нельзя до тех пор, пока
// не будет уверенности, что старых регистраций не осталось: файл лежит по тому
// же адресу /sw.js, поэтому обновление приезжает само, но только при заходе.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name.startsWith('birklik-html-')).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  let d = {}
  try { d = e.data.json() } catch { d = {title: e.data.text()} }
  const t = d.title || 'Birklik.az'
  const o = {
    body: d.body || '',
    icon: '/brand/generated/logo-192x192.png',
    badge: '/brand/generated/logo-96x96.png',
    data: {type: d.type || '', propertyId: d.propertyId || '', bookingId: d.bookingId || ''},
    tag: d.type || 'general',
    renotify: true
  }
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(cl => {
    if (cl.some(c => c.focused)) return
    return self.registration.showNotification(t, o)
  }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const t = e.notification.data?.type
  const p = e.notification.data?.propertyId
  let url = '/'
  if (t === 'booking') url = '/dashboard?tab=bookings&subtab=requests'
  else if (t === 'bookingApproved' || t === 'bookingRejected') url = '/dashboard?tab=bookings&subtab=my-bookings'
  else if (t === 'comment' || t === 'reply') url = p ? `/property/${p}` : '/'
  else if (t === 'favorite' || t === 'rating') url = p ? `/property/${p}` : '/'
  e.waitUntil(clients.matchAll({type: 'window'}).then(cl => {
    for (const c of cl) {
      if (c.url === '/' || c.url.includes('birklik')) return c.focus().then(() => c.navigate(url))
    }
    return clients.openWindow(url)
  }))
})
