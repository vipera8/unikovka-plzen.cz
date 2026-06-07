const CACHE='grollova-cesta-v84-menu-admin-images';
const STATIC=['./','./index.html','./404.html','./style.css','./app.js','./game-data.js','./manifest.webmanifest','./assets/images/certifikat-bez-titulu.jpg','./assets/images/Groll_logo_na_sirku.jpg','./assets/images/Groll_logo_na_vysku.jpg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET') return; e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{ const copy=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return resp; }).catch(()=>r))); });
self.addEventListener('message',e=>{ if(e.data?.type==='CACHE_ALL'){ caches.open(CACHE).then(c=>c.addAll(STATIC)); } });
