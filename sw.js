const CACHE='grollova-cesta-v153-difficulty-copy';
const STATIC=['./','./index.html','./404.html','./style.css','./style.css?v=153','./app.js','./app.js?v=153','./game-data.js','./game-data.js?v=153','./manifest.webmanifest','./assets/images/certifikat-bez-titulu.jpg','./assets/images/groll_uvod.jpg','./assets/images/Groll_logo_na_sirku.jpg','./assets/images/Groll_logo_na_vysku.jpg','./assets/images/06_velka_synagoga_reseni_trojuhelniky.png','./assets/images/web_darkovy_voucher_fade.png','./assets/images/web_klice.jpg','./assets/images/selfie_frame_landscape.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET') return;
 const url=new URL(e.request.url);
 const media=e.request.headers.has('range') || e.request.destination==='audio' || e.request.destination==='video' || /\.(mp3|mp4|m4a|webm)$/i.test(url.pathname);
 if(media){ e.respondWith(fetch(e.request)); return; }
 e.respondWith(fetch(e.request).then(resp=>{
  if(resp && resp.ok){
   const copy=resp.clone();
   caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
  }
  return resp;
 }).catch(()=>caches.match(e.request).then(r=>r || (e.request.mode==='navigate' ? caches.match('./index.html') : Response.error()))));
});
self.addEventListener('message',e=>{ if(e.data?.type==='CACHE_ALL'){ caches.open(CACHE).then(c=>c.addAll(STATIC)); } });




























