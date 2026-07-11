const CACHE='grollova-cesta-v202-groll-selfie-frame-tight';
const STATIC=['./','./index.html','./404.html','./style.css','./style.css?v=198','./app.js','./app.js?v=202','./game-data.js','./game-data.js?v=194','./manifest.webmanifest','./seznam-wmt-iNTy4RkzYHeUNpmhy6t8nriA2EAK4Cqz.txt','./assets/images/certifikat-bez-titulu.jpg','./assets/images/certifikat-kratka-verze.png','./assets/images/groll_uvod.jpg','./assets/images/Groll_logo_na_sirku.jpg','./assets/images/Groll_logo_na_vysku.jpg','./assets/images/groll_selfie_logo_badge.png','./assets/images/groll_selfie_frame_overlay.png','./assets/images/06_velka_synagoga_reseni_trojuhelniky.png','./assets/images/web_darkovy_voucher_fade.png','./assets/images/web_klice.jpg','./assets/images/groll_selfie_overlay.png','./assets/images/selfie_frame_landscape.png','./assets/images/selfie_frame_team_wide.png'];
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




























