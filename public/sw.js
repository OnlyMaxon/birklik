const CACHE_VER='v1-2026-04-23',CACHE_NAME='birklik-html-'+CACHE_VER
self.addEventListener('install',()=>self.skipWaiting())
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(n=>Promise.all(n.map(c=>c.startsWith('birklik-html-')&&c!==CACHE_NAME?caches.delete(c):null))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',e=>{const{request:r}=e,u=new URL(r.url)
if(r.method!=='GET')return
if(r.headers.get('accept')?.includes('text/html')){e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{if(res&&res.status===200){const c=res.clone();caches.open(CACHE_NAME).then(ca=>ca.put(r,c))}return res}).catch(()=>caches.match(r).then(c=>c||caches.match('/index.html').then(i=>i||new Response('Offline',{status:503})))));return}
if(r.url.includes('/assets/')){e.respondWith(fetch(r,{cache:'default',credentials:'same-origin'}).catch(()=>caches.match(r).then(c=>c||new Response('Asset not available',{status:503}))));return}
e.respondWith(fetch(r,{cache:'default'}).then(res=>{if(res&&res.status===200){const c=res.clone();caches.open(CACHE_NAME).then(ca=>ca.put(r,c))}return res}).catch(()=>caches.match(r).then(c=>c||new Response('Resource not available',{status:503}))))})
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()})
self.addEventListener('push',e=>{if(!e.data)return;let d={};try{d=e.data.json()}catch{d={title:e.data.text()}}
const t=d.title||'Birklik.az',o={body:d.body||'',icon:'/brand/generated/logo-192x192.png',badge:'/brand/generated/logo-96x96.png',data:{type:d.type||'',propertyId:d.propertyId||'',bookingId:d.bookingId||''},tag:d.type||'general',renotify:true}
e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cl=>{if(cl.some(c=>c.focused))return;return self.registration.showNotification(t,o)}))})
self.addEventListener('notificationclick',e=>{e.notification.close()
const t=e.notification.data?.type,p=e.notification.data?.propertyId
let url='/'
if(t==='booking')url='/dashboard?tab=bookings&subtab=requests'
else if(t==='bookingApproved'||t==='bookingRejected')url='/dashboard?tab=bookings&subtab=my-bookings'
else if(t==='comment'||t==='reply')url=p?`/property/${p}`:'/'
else if(t==='favorite'||t==='rating')url=p?`/property/${p}`:'/'
e.waitUntil(clients.matchAll({type:'window'}).then(cl=>{for(const c of cl){if(c.url==='/'||c.url.includes('birklik'))return c.focus().then(()=>c.navigate(url))}return clients.openWindow(url)}))})
