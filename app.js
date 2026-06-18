const DATA = window.GAME_DATA;
const $ = (sel, root=document) => root.querySelector(sel);
const app = $('#app');
const LS_KEY = 'grollovaCestaState.v1';
const ADMIN_KEY = 'grollovaCestaAdminLog.v1';
const ACCESS_CODE_KEY = 'grollovaCestaAccessCode.v1';
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const now = () => Date.now();
const normalize = s => (s||'').toString().trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'');
const fmtTime = ms => { ms=Math.max(0,ms||0); const s=Math.floor(ms/1000); const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=s%60; return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
const readJson = (key, fallback) => {
 try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
 catch(e){ localStorage.removeItem(key); return fallback; }
};
function activeAccessCode(){ return sessionStorage.getItem(ACCESS_CODE_KEY) || localStorage.getItem(ACCESS_CODE_KEY) || ''; }
function stateKeyForCode(code){ return code ? `${LS_KEY}.${normalize(code)}` : LS_KEY; }
const getState = () => activeAccessCode() ? readJson(stateKeyForCode(activeAccessCode()), null) : readJson(LS_KEY, null);
const saveState = s => { const key=stateKeyForCode(s?.accessCode || activeAccessCode()); localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem(LS_KEY, JSON.stringify(s)); window._state=s; syncTeamState(s); };
const adminLog = () => readJson(ADMIN_KEY, []);
const addLog = (type, payload={}) => { const s=getState(); const row={time:new Date().toISOString(), type, team:s?.team||'', station:s?.currentStation||1, ...payload}; const rows=adminLog(); rows.push(row); localStorage.setItem(ADMIN_KEY, JSON.stringify(rows)); sendMonitorEvent(row, s); };
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2800); };
const mapsUrl = st => `https://www.google.com/maps/dir/?api=1&destination=${st.coords.lat},${st.coords.lng}`;
const station = id => DATA.stations[id-1];
function monitorEndpoint(){ return String(window.GAME_DATA?.gameMonitorEndpoint || window.GAME_DATA?.leaderboardEndpoint || '').trim(); }
function monitorUrl(action, params={}){
 const endpoint=monitorEndpoint();
 if(!endpoint) return '';
 const url=new URL(endpoint);
 url.searchParams.set('action', action);
 for(const [key,value] of Object.entries(params)){
  if(value!==undefined && value!==null) url.searchParams.set(key, String(value));
 }
 return url.toString();
}
function fireAndForget(url){
 if(!url) return;
 const img=new Image();
 img.src=url;
}
function backendEndpoint(){ return String(window.GAME_DATA?.gameBackendEndpoint || window.GAME_DATA?.gameMonitorEndpoint || window.GAME_DATA?.leaderboardEndpoint || '').trim(); }
function backendUrl(action, params={}){
 const endpoint=backendEndpoint();
 if(!endpoint) return '';
 const url=new URL(endpoint);
 url.searchParams.set('action', action);
 for(const [key,value] of Object.entries(params)){
  if(value!==undefined && value!==null) url.searchParams.set(key, String(value));
 }
 return url.toString();
}
async function backendRequest(action, params={}){
 const url=backendUrl(action, params);
 if(!url) throw new Error('Backend endpoint není nastaven.');
 return await loadJsonp(url);
}
function stationHintCount(st){ return Number(st?.hintCount ?? st?.hints?.length ?? 0); }
function hintText(s,id,num){ return s?.hintTexts?.[id]?.[num] || ''; }
function solutionText(s,id){ return s?.solutionTexts?.[id] || ''; }
function publicTeamState(s){
 if(!s) return null;
 return {
  id:s.id,
  team:s.team || '',
  accessCode:s.accessCode || '',
  startTime:s.startTime || 0,
  currentStation:s.currentStation || 1,
  stationTitle:station(s.currentStation)?.title || '',
  unlocked:s.unlocked || 1,
  completed:s.completed || [],
  hints:s.hints || {},
  solutions:s.solutions || {},
  wrong:s.wrong || {},
  wrongTotal:s.wrongTotal || 0,
  lastPos:s.lastPos || null,
  gpsConsent:!!s.gpsConsent,
  finished:!!s.finished,
  finishTime:s.finishTime || null,
  updatedAt:new Date().toISOString()
 };
}
function syncTeamState(s){
 const data=publicTeamState(s);
 if(!data?.id) return;
 fireAndForget(monitorUrl('state', {
  id:data.id,
  team:data.team,
  accessCode:data.accessCode,
  currentStation:data.currentStation,
  stationTitle:data.stationTitle,
  startTime:data.startTime,
  updatedAt:data.updatedAt,
  finished:data.finished ? 1 : 0,
  finishTime:data.finishTime || '',
  hints:JSON.stringify(data.hints),
  solutions:JSON.stringify(data.solutions),
  wrong:JSON.stringify(data.wrong),
  wrongTotal:data.wrongTotal,
  completed:JSON.stringify(data.completed),
  lastPos:data.lastPos ? JSON.stringify(data.lastPos) : ''
 }));
}
function sendMonitorEvent(row, s){
 if(!s?.id) return;
 const stationId=row.station || s.currentStation || 1;
 const st=station(Number(stationId));
 fireAndForget(monitorUrl('event', {
  teamId:s.id,
  team:s.team || '',
  accessCode:s.accessCode || '',
  time:row.time,
  type:row.type,
  eventName:adminEventName(row),
  station:stationId,
  stationTitle:st?.title || '',
  hint:row.hint || '',
  value:row.value || '',
  detail:JSON.stringify(row)
 }));
}
function loadJsonp(url){
 return new Promise((resolve,reject)=>{
  const cb='grollJsonp_'+Date.now()+'_'+Math.floor(Math.random()*100000);
  const full=new URL(url);
  full.searchParams.set('callback', cb);
  const script=document.createElement('script');
  const cleanup=()=>{ delete window[cb]; script.remove(); };
  const timer=setTimeout(()=>{ cleanup(); reject(new Error('JSONP timeout')); }, 25000);
  window[cb]=data=>{ clearTimeout(timer); cleanup(); resolve(data); };
  script.onerror=()=>{ clearTimeout(timer); cleanup(); reject(new Error('JSONP failed')); };
  script.src=full.toString();
 document.head.appendChild(script);
 });
}
function stateFromOnlineRow(row){
 if(!row?.id) return null;
 return {
  id:String(row.id),
  team:String(row.team || ''),
  accessCode:normalize(row.accessCode || ''),
  startTime:Number(row.startTime || now()),
  currentStation:clamp(Number(row.currentStation || 1),1,DATA.stations.length),
  unlocked:clamp(Number(row.currentStation || 1),1,DATA.stations.length),
  completed:safeJson(row.completed, []),
  wrong:safeJson(row.wrong, {}),
  wrongTotal:Number(row.wrongTotal || 0),
  hints:safeJson(row.hints, {}),
  solutions:safeJson(row.solutions, {}),
  diaryUnlocked:true,
  gpsConsent:!!row.lastPos,
  gpsBypass:[],
  lastPos:safeJson(row.lastPos, null),
  finished:String(row.finished || '0') === '1' || row.finished === true,
  finishTime:row.finishTime ? Number(row.finishTime) || null : null,
  offlineReady:false
 };
}
async function restoreOnlineStateByCode(code){
 window._lastRestoreError='';
 if(!monitorEndpoint()) return null;
 try{
  const data=await loadJsonp(monitorUrl('restore', {accessCode:normalize(code), _: Date.now()}));
  const restored=stateFromOnlineRow(data?.team);
  return restored;
 }catch(e){
  console.warn('Online restore failed', e);
  window._lastRestoreError=e?.message || 'Online průběh se nepodařilo načíst.';
  return null;
 }
}
function defaultState(team){ return { id: globalThis.crypto?.randomUUID?.() || ('team-'+Date.now()), team, startTime: now(), currentStation:1, unlocked:1, completed:[], wrong:{}, wrongTotal:0, hints:{}, solutions:{}, diaryUnlocked:false, gpsConsent:false, gpsBypass:[], lastPos:null, finished:false, finishTime:null, offlineReady:false }; }
function shell(inner){ return `<main class="phone"><header class="topbar"><div class="brand"><b>Grollova cesta</b><span>${getState()?.team ? escapeHtml(getState().team)+' · ' : ''}<span class="timer" id="timer">0:00:00</span></span></div><button class="icon-btn" onclick="openMenu()">☰</button></header><section class="content">${inner}</section></main>`; }
function escapeHtml(s){return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function escapeAttr(s){return escapeHtml(String(s||''));}
function applyCzechTypography(root=document.body){
 const skipTags=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','OPTION']);
 const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
  acceptNode(node){
   const parent=node.parentElement;
   if(!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
   if(!node.nodeValue || !/[ \u00a0][szkvaiouSZKVAIOU] /u.test(' '+node.nodeValue)) return NodeFilter.FILTER_REJECT;
   return NodeFilter.FILTER_ACCEPT;
  }
 });
 const nodes=[];
 while(walker.nextNode()) nodes.push(walker.currentNode);
 for(const node of nodes){
  node.nodeValue=node.nodeValue.replace(/(^|[\s(])([szkvaiouSZKVAIOU])\s+/gu, '$1$2\u00a0');
 }
}
let typographyTimer=null;
function scheduleTypography(root=document.body){
 clearTimeout(typographyTimer);
 typographyTimer=setTimeout(()=>applyCzechTypography(root), 0);
}
const typographyObserver=new MutationObserver(()=>scheduleTypography(document.body));
typographyObserver.observe(document.body, {childList:true, subtree:true});
function cleanDisplayText(text){
 let t = (text||'').toString().trim().replace(/^Groll:\s*/i, '').trim();
 const startsWithOuterQuote = /^[„“\"]/.test(t);
 if(startsWithOuterQuote){
  t = t.replace(/^[„“\"]+\s*/g, '');
  t = t.replace(/\s*[“„\"]+$/g, '');
 }
 return t.trim();
}
function ptxt(s){
 const clean = cleanDisplayText(s);
 if(!clean) return '';
 return clean.split(/\n\s*\n/g).map(paragraph=>`<p class="text-para">${escapeHtml(paragraph.trim()).replace(/\n/g,'<br>')}</p>`).join('');
}
function render(){
 const path = currentRoute();
 if(path==='/hra/app') return renderGameApp();
 if(path==='/hra') return renderAccessGate();
 if(path==='/admin') return renderAdminEntry();
 return renderWebsite();
}
function currentRoute(){
 if(location.hash.startsWith('#/')){
  return location.hash.slice(1).replace(/\/+$/, '') || '/';
 }
 const path = location.pathname.replace(/\/+$/, '');
 if(path.endsWith('/hra/app')) return '/hra/app';
 if(path.endsWith('/hra')) return '/hra';
 if(path.endsWith('/admin')) return '/admin';
 return '/';
}
function setRoute(path, replace=false){
 try{
  const url = `${location.pathname}${location.search}#${path}`;
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
 }catch(e){
  location.hash = path;
 }
}
function renderGameApp(){
 if(!hasGameAccess()){
  setRoute('/hra', true);
  return renderAccessGate();
 }
 const s=getState();
 if(!s) return renderStart();
 if(s.finished) return renderFinish();
 renderStation();
}
function returnToGame(){
 grantGameAccess();
 setRoute('/hra/app', true);
 renderGameApp();
}
function goRoute(path){ setRoute(path); render(); window.scrollTo({top:0,behavior:'smooth'}); }
window.addEventListener('popstate', render);
window.addEventListener('hashchange', render);
window.addEventListener('storage', e=>{
 if((e.key===LS_KEY || e.key===ADMIN_KEY) && $('#onlineAdminPanel')){
  try{
   const modalEl=$('.modal');
   if(modalEl){
    modalEl.innerHTML=adminPanelHtml() + '<button class="btn ghost" style="margin-top:14px" onclick="closeModal()">Zpět do hry</button>';
    loadOnlineAdmin();
   }
  }catch(err){ console.warn('Admin refresh failed', err); }
 }
});
const ACCESS_KEY='grollovaCestaAccess.v1';
function hasGameAccess(){ return localStorage.getItem(ACCESS_KEY)==='ok'; }
async function validateAccessCode(code){
 return await backendRequest('validateAccessCode', {accessCode:normalize(code), _:Date.now()});
}
function grantGameAccess(){ localStorage.setItem(ACCESS_KEY,'ok'); }
function openGameGate(){
 setRoute('/hra');
 renderAccessGate();
 window.scrollTo({top:0,behavior:'smooth'});
 document.body.classList.remove('web-menu-open');
}
function backToWebsite(){
 setRoute('/');
 renderWebsite();
 window.scrollTo({top:0,behavior:'smooth'});
 document.body.classList.remove('web-menu-open');
}



function renderWebsite(){
 app.innerHTML = `<main class="web-page">
  <nav class="web-nav">
   <a class="web-brand" href="#/" onclick="event.preventDefault(); goRoute('/')"><span class="brand-mark">G</span><span>Hravá Plzeň</span></a>
   <button class="web-menu-toggle" onclick="document.body.classList.toggle('web-menu-open')">☰</button>
   <div class="web-menu">
    <a href="#uvod">Úvod</a><a href="#o-hre">O hře</a><a href="#proc">Proč právě tahle hra?</a><a href="#jak">Jak hra probíhá</a><a href="#cenik">Ceník</a><a href="#rezervace">Rezervace</a><a href="#poukazy">Dárkové poukazy</a><a href="#firmy">Pro firmy</a><a href="#faq">FAQ</a><a href="#kontakt">Kontakt</a>
    <a class="web-cta small" href="#/hra" onclick="event.preventDefault(); openGameGate()">Spustit hru</a>
   </div>
  </nav>
  <section id="uvod" class="web-hero">
   <picture><source media="(max-width: 760px)" srcset="assets/images/Groll_pro_web.jpg"><img src="assets/images/Groll_pro_web.jpg" alt="Grollova zlatá stopa – hlavní vizuál"></picture>
   <div class="hero-overlay"></div>
   <div class="hero-content">
    <p class="eyebrow">Venkovní úniková hra v Plzni</p>
    <h1>Grollova zlatá stopa</h1>
    <h2>Plzeň nebudete jen procházet. Budete ji hrát.</h2>
    <p>Vydejte se po stopách Josefa Grolla a zažijte Plzeň jako dobrodružství. Čeká vás venkovní úniková hra v historickém srdci města, ve které budete luštit šifry, otevírat skutečné zámky, používat rekvizity a postupně odhalovat tajemství ukryté mezi plzeňskými ulicemi.</p>
    <p>Na startu dostanete batoh plný tajemství. Uvnitř najdete předměty, které budete během hry opravdu držet v ruce, zkoumat, skládat a používat. Tohle není jen další hra v mobilu. Tohle je skutečný zážitek.</p>
    <p class="hero-facts">13 zastávek. 3–4 hodiny dobrodružství. Skutečné rekvizity. Historická Plzeň jako hřiště.</p>
    <div class="hero-actions"><a class="web-cta" href="#rezervace">Rezervovat hru</a><a class="web-cta alt" href="#poukazy">Koupit dárkový poukaz</a></div>
   </div>
  </section>
  <section class="web-section feature-row">
   ${webFeature('Batoh plný tajemství','Na startu získáte herní batoh s rekvizitami, šiframi a zámky. Každý předmět má svůj význam — jen ho musíte objevit ve správný okamžik.')}
   ${webFeature('Skutečné zámky, skutečné rekvizity, skutečný zážitek','Nebudete jen ťukat odpovědi do telefonu. Budete otevírat, hledat, porovnávat, skládat a používat skutečné předměty.')}
   ${webFeature('Plzeň jako jedna velká šifra','Historické centrum města se promění v hřiště plné stop, symbolů a detailů, kterých byste si při běžné procházce možná nikdy nevšimli.')}
  </section>
  <section id="proc" class="web-section"><h2>Proč právě Grollova zlatá stopa?</h2><p class="section-lead">Protože to není obyčejná procházka městem ani mobilní hra, kterou odklikáte na displeji. Grollova zlatá stopa propojuje to nejlepší z venkovní únikovky, městského dobrodružství a autentického zážitku s fyzickými rekvizitami.</p><div class="web-grid three">
   ${webReason('1. Není to jen mobilní únikovka','Mobil vás hrou provede, ale hlavní zážitek se odehrává ve skutečném světě. V rukou budete držet herní předměty, zámky, šifry a indicie, které vás povedou dál.')}
   ${webReason('2. Dostanete batoh plný tajemství','Hned na startu získáte batoh, který ukrývá vše potřebné pro cestu. Některé věci využijete hned, jiné budou dávat smysl až později.')}
   ${webReason('3. Budete opravdu hrát, ne jen chodit','Na každé zastávce vás čeká úkol, stopa nebo šifra. Budete pozorovat okolí, hledat souvislosti, používat rekvizity a spolupracovat jako tým.')}
   ${webReason('4. Poznáte Plzeň jinak','Hra vás zavede do historického srdce města, ale přesná trasa zůstává tajemstvím. Budete si všímat detailů, které běžně míjíte bez povšimnutí.')}
   ${webReason('5. Zážitek na celé odpoledne','Připravte se na přibližně 3–4 hodiny dobrodružství, 13 zastávek a trasu dlouhou asi 4–4,5 km.')}
   ${webReason('6. Příběh, který patří Plzni','Josef Groll, pivovarská atmosféra, staré městské stopy a historické kulisy Plzně dávají hře jedinečnou identitu.')}
  </div><div class="section-divider-art"><img class="web-illustration" src="assets/images/web_zamek_klic.jpg" alt="Starý zámek a klíč jako symbol herních rekvizit" loading="lazy"></div></section>
  <section id="o-hre" class="web-section"><div class="split"><div><h2>Venkovní úniková hra v historickém srdci Plzně</h2><p>Grollova zlatá stopa je příběhová venkovní úniková hra pro 2–5 hráčů. Zavede vás do atmosféry staré Plzně, k příběhu Josefa Grolla a k tajemství, které budete odhalovat krok za krokem.</p><p>Na začátku znáte jen místo startu. Další cesta se vám otevře až během hry. Budete řešit šifry, pracovat s herním batohem, otevírat zámky a sledovat stopy ukryté ve městě.</p><p>Hra je vhodná pro páry, přátele, rodiny i firemní týmy. Nemusíte být zkušení hráči únikových her — obtížnost je nastavena pro začátečníky až mírně pokročilé.</p></div><div class="info-card"><h3>Základní informace</h3><ul><li><b>Místo:</b> Plzeň</li><li><b>Start:</b> Hlavní vlakové nádraží, hlavní hala, u sochy Železničáře</li><li><b>Délka trasy:</b> cca 4–4,5 km</li><li><b>Doba hry:</b> cca 3–4 hodiny</li><li><b>Počet hráčů:</b> 2–5</li><li><b>Obtížnost:</b> začátečník až mírně pokročilý</li><li><b>Záloha na batoh:</b> 1 000 Kč vratná</li></ul></div></div><div class="section-divider-art"><img class="web-illustration" src="assets/images/web_mapa_plzne.jpg" alt="Stará mapa Plzně" loading="lazy"></div></section>
  <section class="web-section dark-band"><h2>Batoh plný tajemství. Město plné stop. Jeden příběh, který čeká na odhalení.</h2><p>Na startu hry nedostanete jen odkaz do mobilu. Dostanete do rukou herní batoh, který je srdcem celého dobrodružství.</p><p>Uvnitř najdete rekvizity, zámky, šifry a tematické předměty, které budete během cesty postupně využívat. Některé vás navedou hned. Jiné vás možná budou mást, dokud nenastane správný okamžik.</p><p>Právě díky batohu má hra atmosféru opravdové únikovky. Budete zkoumat, otevírat, porovnávat, skládat a hledat význam v detailech.</p><p class="hero-facts">Sáhnete si na příběh vlastníma rukama.</p><div class="section-divider-art"><img class="web-illustration" src="assets/images/web_klice.jpg" alt="Staré klíče jako součást herních rekvizit" loading="lazy"></div></section>
  <section id="jak" class="web-section"><h2>Jak to celé funguje?</h2><div class="steps">${webStep(1,'Rezervujete si termín','Vyberete si den a čas, který vám vyhovuje.')}${webStep(2,'Dorazíte na start','Hra začíná v hlavní hale plzeňského vlakového nádraží, u sochy Železničáře.')}${webStep(3,'Převezmete herní batoh','Na startu dostanete batoh s rekvizitami a přístup do herní webové aplikace.')}${webStep(4,'Vydáte se po stopách Grolla','Hra vás povede historickým centrem Plzně. Přesná trasa je tajná a odhalíte ji až během hry.')}${webStep(5,'Řešíte šifry a otevíráte zámky','Budete používat postřeh, logiku, spolupráci i předměty z batohu.')}${webStep(6,'Odhalíte závěrečné tajemství','Každá stopa vás posune blíž k cíli.')}</div></section>
  <section class="web-section"><h2>Pro koho je Grollova zlatá stopa?</h2><div class="web-grid five">${webAudience('Pro páry','Originální zážitek v Plzni, který je mnohem zajímavější než obyčejná procházka nebo večeře.')}${webAudience('Pro přátele','Společné dobrodružství, při kterém si vyzkoušíte týmovou spolupráci, logiku i postřeh.')}${webAudience('Pro rodiny','Zábavná cesta městem, při které se zapojí děti i dospělí. Menší děti budou potřebovat pomoc dospělých.')}${webAudience('Pro turisty','Poznáte Plzeň jinak než podle běžného průvodce. Město se na několik hodin promění v hru.')}${webAudience('Pro firmy','Netradiční teambuilding, při kterém nejde o nudné sezení v místnosti, ale o společný zážitek v ulicích historické Plzně.')}</div><div class="section-divider-art compass-art"><img class="web-illustration-small" src="assets/images/web_kompas.jpg" alt="Starý kompas jako symbol cesty a hledání směru" loading="lazy"></div></section>
  <section id="cenik" class="web-section"><h2>Ceník hry</h2><p class="section-lead">Vyberte si velikost týmu a vydejte se po Grollově zlaté stopě.</p><div class="price-grid"><div><h3>2 hráči</h3><strong>1 200 Kč</strong></div><div><h3>3 hráči</h3><strong>1 400 Kč</strong></div><div><h3>4–5 hráčů</h3><strong>1 600 Kč</strong></div></div><p>Cena zahrnuje zapůjčení herního batohu s rekvizitami, přístup do herní webové aplikace a celý herní zážitek.</p><p class="note">Při převzetí batohu se skládá vratná záloha 1 000 Kč, která bude po vrácení kompletního a nepoškozeného vybavení vrácena zpět.</p></section>
  <section id="rezervace" class="web-section split"><div><h2>Rezervujte si dobrodružství v Plzni</h2><p>Vyberte si termín a vydejte se po stopách Josefa Grolla. Rezervace je platná po uhrazení ceny hry. Platit můžete QR kódem nebo bankovním převodem.</p><p>Po přijetí platby vám rezervaci potvrdíme a pošleme všechny potřebné informace ke startu hry.</p><ul><li>Start: Hlavní vlakové nádraží v Plzni, hlavní hala, u sochy Železničáře</li><li>Délka hry: přibližně 3–4 hodiny</li><li>Doporučený počet hráčů: 2–5 osob</li><li>Obtížnost: začátečník až mírně pokročilý</li></ul></div>${webForm('rezervace','Rezervace hry',['Jméno a příjmení','E-mail','Telefon','Požadovaný termín','Požadovaný čas','Počet dospělých','Počet dětí','Poznámka'],true,'Děkujeme za rezervaci. Brzy vám pošleme platební údaje a po přijetí platby rezervaci potvrdíme.')}</section>
  <section id="poukazy" class="web-section split alt-bg"><div><h2>Darujte Plzeň jako dobrodružství</h2><p>Hledáte originální dárek, který neskončí v šuplíku? Darujte zážitek, při kterém se Plzeň promění v hru.</p><p>Dárkový poukaz na Grollovu zlatou stopu je vhodný pro páry, přátele, rodiny i všechny, kteří mají rádi zážitky, historii, šifry a trochu tajemství.</p><p>Poukaz je možné vystavit elektronicky. Na přání lze doplnit jméno obdarovaného a osobní věnování.</p><div class="section-divider-art voucher-art"><img class="web-illustration voucher-illustration" src="assets/images/web_darkovy_voucher_fade.png" alt="Dárkový voucher na hru Grollova zlatá stopa" loading="lazy"></div></div>${webForm('poukaz','Objednat dárkový poukaz',['Jméno objednatele','E-mail','Telefon','Jméno obdarovaného','Počet osob','Věnování na poukaz','Elektronický / tištěný poukaz','Poznámka'],false,'Děkujeme za objednávku poukazu. Ozveme se vám s dalšími informacemi.')}</section>
  <section id="firmy" class="web-section split"><div><h2>Teambuilding, který se neodehrává u stolu</h2><p>Zapomeňte na běžný firemní program. Grollova zlatá stopa vezme váš tým do ulic Plzně, kde bude potřeba spolupracovat, hledat souvislosti, řešit šifry a používat skutečné herní rekvizity.</p><p>Hra podporuje komunikaci, týmové myšlení a zapojení všech členů skupiny. Každý si může najít svou roli.</p><p>Je to ideální volba pro menší firemní týmy, neformální teambuilding nebo zážitkový program v Plzni.</p><div class="section-divider-art team-art"><img class="web-illustration voucher-illustration team-illustration" src="assets/images/web_teambuilding.jpg" alt="Teambuildingová atmosféra se společnou mapou, kompasem a týmovou spoluprací" loading="lazy"></div></div>${webForm('firma','Poptat firemní termín',['Název firmy','Kontaktní osoba','E-mail','Telefon','Počet osob','Preferovaný termín','Poznámka'],false,'Děkujeme za poptávku. Brzy se vám ozveme.')}</section>
  <section class="web-section"><h2>Co si vzít s sebou?</h2><p>Ke hře nepotřebujete žádné speciální vybavení. Vše důležité dostanete na startu v herním batohu.</p><ul class="check-list"><li>nabitý chytrý telefon</li><li>mobilní internet</li><li>pohodlnou obuv</li><li>oblečení podle počasí</li><li>ideálně powerbanku</li><li>chuť objevovat a trochu trpělivosti při luštění</li></ul><p>Hra probíhá venku, proto se oblečte podle aktuálního počasí.</p></section>
  <section class="web-section dark-band"><h2>Pravidla hry</h2><p>Grollova zlatá stopa probíhá ve veřejném prostoru historického centra Plzně. Všechny úkoly jsou navrženy tak, aby byly řešitelné bezpečně, bez vstupování do zakázaných prostor a bez použití síly.</p><p>Během hry není potřeba nic ničit, rozebírat, přelézat ani násilím otevírat. Všechny odpovědi najdete pozorováním, logikou a správným použitím herních pomůcek.</p><p>Prosíme hráče, aby během hry dodržovali pravidla silničního provozu, respektovali veřejný prostor a brali ohled na ostatní návštěvníky města.</p><p>Za děti odpovídá dospělý doprovod.</p></section>
  <section id="faq" class="web-section"><h2>FAQ</h2><div class="faq-grid">${webFaq('Musíme si instalovat aplikaci?','Ne. Hra běží ve webové aplikaci, kterou otevřete v telefonu. Stačí mobilní internet.')}${webFaq('Dozvíme se trasu předem?','Ne. Přesná trasa je součástí hry a budete ji objevovat postupně. Předem znáte pouze místo startu.')}${webFaq('Co když se zasekneme?','Ve hře jsou dostupné nápovědy, které vás postupně navedou dál.')}${webFaq('Je hra vhodná pro děti?','Ano, ale šifry jsou navržené hlavně pro dospělé a starší děti. Menší děti se mohou zapojit s pomocí dospělých.')}${webFaq('Jak dlouho hra trvá?','Přibližně 3–4 hodiny podle tempa týmu.')}${webFaq('Kolik měří trasa?','Přibližně 4–4,5 km.')}${webFaq('Kde hra začíná?','V hlavní hale plzeňského vlakového nádraží, u sochy Železničáře.')}${webFaq('Co když bude pršet?','Hra probíhá venku, proto doporučujeme sledovat počasí. V případě velmi nepříznivého počasí je možné domluvit náhradní termín.')}</div></section>
  <section id="kontakt" class="web-section contact-section"><h2>Kontakt</h2><p><b>Telefon:</b> <a href="tel:+420737256827">737 256 827</a><br><b>E-mail:</b> <a href="mailto:hravaplzen@gmail.com">hravaplzen@gmail.com</a></p>${webForm('kontakt','Napište nám',['Jméno','E-mail','Telefon','Zpráva'],false,'Děkujeme za zprávu. Brzy se ozveme.')}</section>
  <footer class="web-footer"><p>© Hravá Plzeň · Grollova zlatá stopa</p><a class="web-cta small play-game-button" href="#/hra" onclick="event.preventDefault(); openGameGate()">Spustit hru</a></footer>
 </main>`;
 document.body.classList.remove('web-menu-open');
}
function webFeature(title,text){return `<article class="feature-card"><h3>${title}</h3><p>${text}</p></article>`}
function webReason(title,text){return `<article class="reason-card"><h3>${title}</h3><p>${text}</p></article>`}
function webStep(n,title,text){return `<article class="step"><span>${n}</span><div><h3>${title}</h3><p>${text}</p></div></article>`}
function webAudience(title,text){return `<article class="audience"><h3>${title}</h3><p>${text}</p></article>`}
function webFaq(q,a){return `<details><summary>${q}</summary><p>${a}</p></details>`}
function webForm(type,title,fields,terms,msg){
 const inputs=fields.map(f=>`<label>${f}<input name="${f}" ${f.includes('E-mail')?'type="email"':f.includes('termín')||f.includes('Termín')?'type="date"':f.includes('čas')||f.includes('Čas')?'type="time"':'type="text"'} ${f.includes('Poznámka')||f.includes('Zpráva')?'data-long="1"':''}></label>`).join('');
 return `<form class="web-form" onsubmit="submitLeadForm(event,'${type}','${msg.replace(/'/g,'&#039;')}')"><h3>${title}</h3><input class="hp-field" name="website" tabindex="-1" autocomplete="off">${inputs}<label class="check"><input type="checkbox" required> <span>Souhlasím se zpracováním osobních údajů.</span></label>${terms?`<label class="check"><input type="checkbox" required> <span>Souhlasím s obchodními a storno podmínkami.</span></label>`:''}<button class="web-cta" type="submit">Odeslat</button><p class="form-confirm" aria-live="polite"></p></form>`;
}
async function submitLeadForm(e,type,message){
 e.preventDefault();
 const form=e.currentTarget;
 if(form.website?.value) return;
 const fd=new FormData(form);
 const payload={};
 for(const [k,v] of fd.entries()){ if(k==='website') continue; if(String(v).trim()) payload[k]=String(v).trim(); }
 const btn=form.querySelector('button[type="submit"]');
 const confirm=form.querySelector('.form-confirm');
 if(btn) btn.disabled=true;
 try{
  const data=await backendRequest('lead', {type, payload:JSON.stringify(payload), _:Date.now()});
  if(!data?.ok) throw new Error(data?.error || 'lead_failed');
  if(confirm) confirm.textContent=message;
  form.reset();
 }catch(err){
  if(confirm) confirm.textContent='Odeslání se nepodařilo. Zkuste to prosím znovu nebo nám napište e-mail.';
  toast('Odeslání se nepodařilo. Zkuste to prosím znovu.');
 }finally{
  if(btn) btn.disabled=false;
 }
}
function renderAccessGate(){
 app.innerHTML = `<main class="phone access-gate"><section class="content"><div class="hero hero-intro"><h1>Spustit hru</h1><p>Zadejte přístupový kód, který jste obdrželi po rezervaci.</p></div><div class="card"><label>Přístupový kód</label><input id="accessCode" type="text" placeholder="KÓD" autocomplete="one-time-code"><button id="accessContinue" class="btn" type="button" style="margin-top:12px">Pokračovat</button><p id="accessError" class="small" style="display:none;color:#b3261e;font-weight:800;margin-top:10px">Tento kód není platný. Zkontrolujte ho prosím a zkuste to znovu.</p><p class="small muted">Kód slouží pouze pro spuštění zaplacené hry.</p></div><button class="btn ghost" type="button" onclick="backToWebsite()">Zpět na web</button></section></main>`;
 setTimeout(()=>{
  const input=$('#accessCode');
  const btn=$('#accessContinue');
  if(input) input.focus();
  if(btn) btn.addEventListener('click', verifyAccessCode);
  if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); verifyAccessCode(); }});
 },50);
}
async function verifyAccessCode(){
 const input=$('#accessCode');
 const btn=$('#accessContinue');
 const err=$('#accessError');
 const val=input?.value || '';
 let result=null;
 if(btn) btn.disabled=true;
 try{
  result=await validateAccessCode(val);
 }catch(e){
  if(err){ err.textContent='Kód se nepodařilo ověřit. Zkontrolujte připojení k internetu a zkuste to znovu.'; err.style.display='block'; }
  toast('Kód se nepodařilo ověřit. Zkuste to znovu.');
  if(input) input.focus();
  if(btn) btn.disabled=false;
  return false;
 }
 if(btn) btn.disabled=false;
 if(!result?.ok){
  if(err){ err.textContent='Tento kód není platný. Zkontrolujte ho prosím a zkuste to znovu.'; err.style.display='block'; }
  toast('Tento kód není platný. Zkontrolujte ho prosím a zkuste to znovu.');
  if(input){ input.classList.add('shake'); setTimeout(()=>input.classList.remove('shake'),450); input.focus(); }
  return false;
 }
 if(err) err.style.display='none';
 const code=normalize(result.accessCode || val);
 sessionStorage.setItem(ACCESS_CODE_KEY, code);
 localStorage.setItem(ACCESS_CODE_KEY, code);
 grantGameAccess();
 if(!getState()){
 toast('Kontroluji uložený průběh hry...');
  const restored=await restoreOnlineStateByCode(code);
  if(restored) saveState(restored);
  else if(window._lastRestoreError){
   toast('Rozehranou hru se nepodařilo načíst. Zkuste obnovit stránku.');
   if(err){ err.textContent='Rozehranou hru se nepodařilo načíst z online úložiště. Zkuste stránku obnovit nebo ověřte připojení k internetu.'; err.style.display='block'; }
   return false;
  }
 }
 setRoute('/hra/app');
 renderGameApp();
 return true;
}
window.verifyAccessCode = verifyAccessCode;
function renderAdminEntry(){
 const backAction = getState() ? 'returnToGame()' : 'backToWebsite()';
 const backText = getState() ? 'Zpět do hry' : 'Zpět na web';
 app.innerHTML = `<main class="phone"><section class="content"><div class="hero hero-intro"><h1>Admin / test</h1><p>Přístup do administrace a testovacího režimu.</p></div><form id="adminLoginForm" class="card" onsubmit="return adminLogin(event)"><input id="adminPass" type="password" placeholder="Heslo" autocomplete="current-password"><button id="adminLoginBtn" class="btn" style="margin-top:10px" type="submit" onclick="return adminLogin(event)">Vstoupit</button><p id="adminLoginError" class="small" style="display:none;color:#b3261e;font-weight:800;margin-top:10px"></p><p class="small muted">Admin se nezobrazuje v hráčském menu. Přístup je pouze přes adresu /admin a heslo.</p></form><button class="btn ghost" onclick="${backAction}">${backText}</button></section></main>`;
 const form=$('#adminLoginForm');
 const input=$('#adminPass');
 if(form) form.addEventListener('submit', e=>{ e.preventDefault(); adminLogin(); });
 if(input) setTimeout(()=>input.focus(), 50);
}

function renderStart(){ app.innerHTML = `<main class="phone"><section class="content"><figure class="start-visual"><img src="assets/images/groll_uvod.jpg" alt="Grollova zlatá stopa" loading="eager"></figure><div class="hero hero-intro start-copy"><p class="hero-subtitle">Venkovní úniková hra v historickém srdci Plzně.</p><p class="lead">Čeká vás 13 zastávek, historické město a zamčená tajemství. Dívejte se pozorně, poslouchejte a použijte vše, co po cestě získáte.</p></div><div class="card"><label>Název týmu</label><input id="teamName" type="text" placeholder="Např. Sládkové z Plzně" autocomplete="off"></div><div class="accordion"><button class="acc-head" onclick="toggleAcc(this)">Pravidla hry <span>⌄</span></button><div class="acc-body">${rulesText()}</div></div><div class="card"><label class="check"><input id="agree" type="checkbox"> <span>Potvrzuji, že se účastním hry dobrovolně a na vlastní odpovědnost. Budu dodržovat pravidla hry, pravidla silničního provozu a nebudu vstupovat do nebezpečných ani zakázaných míst.</span></label></div><div class="accordion location-accordion open"><button class="acc-head" onclick="toggleAcc(this)">Použití polohy <span>⌄</span></button><div class="acc-body location-body"><p>Poloha nám pomůže navést vás k další zastávce, ověřit, že jste na správném místě, a v případě SOS poslat správci vaši aktuální pozici.</p></div><div class="location-actions"><button class="btn" onclick="requestPosBeforeStart()">Povolit polohu</button><button class="text-link location-skip" onclick="continueWithoutLocation()">Pokračovat bez polohy</button></div></div><button class="btn" onclick="startGame()">Načepovat první stopu</button></section></main>`; }
function rulesText(){return `Hra vás provede 13 zastávkami v centru Plzně. Na každé zastávce sledujte pokyny v aplikaci, používejte předměty, které získáte po cestě, a pozorně si všímejte okolí.

Hra probíhá ve veřejném městském prostoru. Hrajte bezpečně, dodržujte pravidla silničního provozu a nevstupujte do silnice, na koleje, do uzavřených prostor ani nikam, kam není běžně povolený vstup. Všechny úkoly jsou řešitelné z veřejně přístupných míst.

S herními předměty zacházejte opatrně a nepoužívejte sílu. Pokud něco nejde otevřít, otočit nebo spojit, pravděpodobně ještě nemáte správné řešení.

Za děti účastnící se hry odpovídá jejich dospělý doprovod.

Čas se měří od spuštění hry až do dokončení poslední zastávky. Hru můžete kdykoliv přerušit a pokračovat později, ale čas běží dál.

Pokud se zaseknete, použijte nápovědu. Pokud nastane technický problém nebo budete potřebovat pomoc, použijte tlačítko SOS.

Přejeme vám šťastnou cestu po Grollových stopách.`;}
function startGame(){ const team=$('#teamName').value.trim(); if(!team) return toast('Zadejte název týmu.'); if(!$('#agree').checked) return toast('Nejprve potvrďte pravidla a odpovědnost.'); grantGameAccess(); const s=defaultState(team); s.accessCode=sessionStorage.getItem(ACCESS_CODE_KEY)||''; s.gpsConsent = window._gpsOk || false; if(window._lastPos) s.lastPos=window._lastPos; saveState(s); addLog('start'); if(currentRoute()!=='/hra/app') setRoute('/hra/app', true); renderGameApp(); }
function continueWithoutLocation(){ window._gpsOk=false; alert('Hru můžete hrát i bez sdílení polohy. Navigace z aplikace a odeslání vaší polohy přes SOS ale nebudou fungovat.'); }
function requestPosBeforeStart(){ if(!navigator.geolocation) return toast('Poloha není v tomto prohlížeči dostupná.'); navigator.geolocation.getCurrentPosition(pos=>{ window._gpsOk=true; window._lastPos={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy}; toast('Poloha povolena.'); },()=>toast('Poloha nebyla povolena nebo se ji nepodařilo načíst.'),{enableHighAccuracy:true,timeout:8000}); }
function renderStation(){ const s=getState(); const st=station(s.currentStation); const doneCount=s.completed.length; const needsGps = !s.gpsBypass.includes(st.id) && !s[`gpsOk${st.id}`]; if(st.id>1 && DATA.gpsMode!=='off' && needsGps) return renderArrivalCheck(st); const hintState=s.hints[st.id]||0; const firstIntroOnly = st.id===1 && !s.diaryUnlocked; app.innerHTML=shell(`<div class="station-head compact"><div class="station-title-line"><span class="station-title-text">${st.id}/${DATA.stations.length} – ${escapeHtml(st.title)}</span>${BeerProgress({completedStops:doneCount,totalStops:DATA.stations.length,size:'small',animated:false})}</div><button class="icon-btn danger" onclick="openSOS()">SOS</button></div>${renderStationSpecial(st,s,hintState)}${firstIntroOnly?'':`<div class="footer-actions"><button class="btn" onclick="openCode()">Zadat kód</button></div>`}`); startTimer(); if(!firstIntroOnly) prefetchStationHints(st.id); }
function renderStationSpecial(st,s,hintState){
 if(st.id===1 && !s.diaryUnlocked){
  const intro = st.intro.split('Tlačítko:')[0];
  return `${stationImage(st, true)}${introPanel(st, true, intro)}<button class="btn" onclick="unlockDiary()">Deník odemčen</button>`;
 }
 let intro = st.intro;
 if(st.id===1 && intro.includes('Po odemčení:')) intro = intro.split('Po odemčení:').pop();
 return `${stationImage(st, false)}${introPanel(st, false, intro)}${st.id===5?`<button id="jingleBtn" class="btn secondary" style="margin-top:8px" onclick="toggleJingle()">Přehrát znělku</button>`:''}<div class="accordion"><button class="acc-head" onclick="toggleAcc(this); markMore(${st.id})">Chci vědět víc <span>⌄</span></button><div class="acc-body">${st.audio?`<audio controls preload="none" src="assets/audio/${encodeURI(st.audio)}"></audio>`:''}<div style="margin-top:10px">${ptxt(st.more)}</div></div></div>${renderHints(st,hintState)}`;
}
function currentStationImage(st, firstScreen=false){ return firstScreen ? (st.image || '') : (st.image2 || st.image || ''); }
function currentIntroAudio(st, firstScreen=false){ return firstScreen ? (st.introAudio || '') : (st.introAudio2 || st.introAudio || ''); }
function stationImage(st, firstScreen=false){
 const img=currentStationImage(st, firstScreen);
 if(!img) return '';
 const extra = st.id===8 ? ' station-08-image' : (st.id===3 ? ' station-03-image' : (st.id===11 ? ' station-11-image' : ''));
 const wrapExtra = st.id===8 ? ' station-08-wrap' : '';
 return `<figure class="station-image-wrap${wrapExtra}"><img class="station-image${extra}" src="assets/images/${encodeURI(img)}" alt="${escapeHtml(st.title)}" loading="eager" onerror="this.closest('.station-image-wrap').style.display='none'"></figure>`;
}
function introPanel(st, firstScreen=false, intro=''){
 const audio=currentIntroAudio(st, firstScreen);
 const audioPart = audio
  ? `<audio class="intro-player" controls preload="metadata" src="assets/audio/${encodeURI(audio)}"></audio>`
  : `<p class="small muted">Úvodní audio pro tuto zastávku zatím chybí.</p>`;
 const extraTitle = st.introImageTitle ? `<div class="intro-image-title">${escapeHtml(st.introImageTitle)}</div>` : '';
 const extraImage = st.introImage ? `<figure class="intro-image-wrap"><img class="intro-inline-image" src="assets/images/${encodeURI(st.introImage)}" alt="${escapeHtml(st.introImageTitle || st.title)}" loading="lazy" onerror="this.closest('.intro-image-wrap').style.display='none'"></figure>` : '';
 return `<div class="accordion intro-accordion"><button class="acc-head" onclick="toggleAcc(this)">Úvod a zadání <span>⌄</span></button><div class="acc-body">${audioPart}<div class="intro-transcript">${ptxt(intro)}</div>${extraTitle}${extraImage}</div></div>`;
}
function renderHintContent(hint){
 if(typeof hint === 'string') return ptxt(hint);
 if(!hint || typeof hint !== 'object') return '';
 const before = hint.textBefore ? `<div>${ptxt(hint.textBefore)}</div>` : '';
 let image = '';
 if(hint.image){
   const imageClass = hint.image.includes('07_namesti_republiky_symboly') ? 'hint-image hint-image-75 hint-image-transparent-bg' : (hint.image.includes('09_vodarenska_vez_napoveda_3_symbol') ? 'hint-image hint-image-small-symbol' : 'hint-image');
   const wrapClass = hint.image.includes('07_namesti_republiky_symboly') ? 'hint-image-wrap hint-image-wrap-transparent' : (hint.image.includes('09_vodarenska_vez_napoveda_3_symbol') ? 'hint-image-wrap hint-image-wrap-small-symbol' : 'hint-image-wrap');
   image = `<figure class="${wrapClass}"><img class="${imageClass}" src="${secretImageSrc(hint)}" alt="Nápověda" loading="lazy" onerror="this.closest('.hint-image-wrap').style.display='none'"></figure>`;
 }
 const after = hint.textAfter ? `<div>${ptxt(hint.textAfter)}</div>` : '';
 return `${before}${image}${after}`;
}
function renderSolutionContent(solution){
 if(typeof solution === 'string') return ptxt(solution);
 if(!solution || typeof solution !== 'object') return '';
 const before = solution.textBefore ? `<div>${ptxt(solution.textBefore)}</div>` : '';
 const image = solution.image
  ? `<figure class="hint-image-wrap solution-image-wrap"><img class="hint-image solution-image" src="${secretImageSrc(solution)}" alt="${escapeAttr(solution.alt || 'Řešení')}" loading="lazy" onerror="this.closest('.hint-image-wrap').style.display='none'"></figure>`
  : '';
 const after = solution.textAfter ? `<div>${ptxt(solution.textAfter)}</div>` : '';
 return `${before}${image}${after}`;
}
function secretImageSrc(item){
 if(item?.imageDataUrl) return item.imageDataUrl;
 return `assets/images/${encodeURI(item?.image || '')}`;
}

function renderHints(st, hintState){
 let html='';
 const s=getState();
 const openedSolution = !!(s?.solutions?.[st.id]);
 const hintCount=stationHintCount(st);
 for(let i=0;i<hintCount;i++){
  // Na začátku je vidět pouze Nápověda 1. Každá otevřená nápověda zpřístupní další.
  if(i===0 || hintState>=i){
   const num=i+1;
   const opened = hintState>=num;
   const body = opened ? renderHintContent(hintText(s, st.id, num)) : '';
   html+=`<div class="accordion ${opened?'open':''}"><button class="acc-head" onclick="openHint(${st.id},${num})">Nápověda ${num} <span>⌄</span></button><div class="acc-body">${body}</div></div>`;
  }
 }
 // Řešení se zobrazí až po otevření poslední nápovědy. Předchozí nápovědy zůstávají dostupné.
 if(hintState>=hintCount){
  const body = openedSolution ? renderSolutionContent(solutionText(s, st.id)) : '';
  html+=`<div class="accordion ${openedSolution?'open':''}"><button class="acc-head" onclick="openSolution(${st.id}, this)">Řešení <span>⌄</span></button><div class="acc-body">${body}</div></div>`;
 }
 return html;
}
function renderArrivalCheck(st){
 const s=getState() || {};
 const canBypass=(s.gpsCanBypass||[]).includes(st.id);
 const gpsMsg=s.gpsMessage && s.gpsMessage[st.id] ? `<div class="card gps-warning"><p class="small">${escapeHtml(s.gpsMessage[st.id])}</p></div>` : '';
 const bypassButton=canBypass ? `<button class="btn ghost" onclick="manualGps(${st.id})">GPS nefunguje - pokračovat</button>` : '';
 app.innerHTML=shell(`<div class="hero"><span class="pill">Další zastávka</span><h2>${escapeHtml(st.title)}</h2><p>Než se zobrazí obsah zastávky, ověříme, že jste poblíž místa.</p></div>${gpsMsg}<div class="grid"><a class="btn" href="${mapsUrl(st)}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Navigovat na zastávku</a><button class="btn secondary" onclick="checkGps(${st.id})">Jsem na místě</button>${bypassButton}</div>`);
 startTimer();
}
function enableGpsBypass(id,msg){
 const s=getState();
 s.gpsCanBypass=[...new Set([...(s.gpsCanBypass||[]),id])];
 s.gpsMessage={...(s.gpsMessage||{}),[id]:msg};
 saveState(s);
 renderArrivalCheck(station(id));
}
function checkGps(id){
 const st=station(id);
 if(!navigator.geolocation){
  enableGpsBypass(id,'GPS není dostupná. Pokud jste opravdu na místě, můžete pokračovat bez ověření polohy.');
  toast('GPS není dostupná. Můžete pokračovat bez ověření polohy.');
  return;
 }
 navigator.geolocation.getCurrentPosition(pos=>{
  const d=distanceMeters(pos.coords.latitude,pos.coords.longitude,st.coords.lat,st.coords.lng);
  const s=getState();
  s.lastPos={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy};
  if(d<=DATA.gpsRadiusMeters){
   s[`gpsOk${id}`]=true;
   if(s.gpsCanBypass) s.gpsCanBypass=s.gpsCanBypass.filter(x=>x!==id);
   if(s.gpsMessage) delete s.gpsMessage[id];
   saveState(s);
   addLog('gps_ok',{distance:Math.round(d)});
   returnToGame();
  } else {
   saveState(s);
   addLog('gps_failed',{distance:Math.round(d)});
   const msg=`Podle GPS jste asi ${Math.round(d)} m od zastávky. Zkuste navigaci, nebo pokud GPS nefunguje a jste na správném místě, použijte tlačítko GPS nefunguje - pokračovat.`;
   enableGpsBypass(id,msg);
   toast(`Podle GPS jste asi ${Math.round(d)} m od zastávky.`);
  }
 },()=>{
  enableGpsBypass(id,'Polohu se nepodařilo zjistit. Zkuste znovu, nebo pokud jste opravdu na místě, pokračujte bez ověření polohy.');
  toast('Polohu se nepodařilo zjistit. Můžete pokračovat bez ověření polohy.');
 },{enableHighAccuracy:true,timeout:9000});
}
function manualGps(id){
 const s=getState();
 s.gpsBypass=[...new Set([...(s.gpsBypass||[]),id])];
 s[`gpsOk${id}`]=true;
 if(s.gpsCanBypass) s.gpsCanBypass=s.gpsCanBypass.filter(x=>x!==id);
 if(s.gpsMessage) delete s.gpsMessage[id];
 saveState(s);
 addLog('gps_bypass');
 returnToGame();
}
function distanceMeters(a,b,c,d){ const R=6371000, toRad=x=>x*Math.PI/180; const f1=toRad(a), f2=toRad(c), df=toRad(c-a), dl=toRad(d-b); const x=Math.sin(df/2)**2+Math.cos(f1)*Math.cos(f2)*Math.sin(dl/2)**2; return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); }
function BeerProgress({completedStops=0,totalStops=13,size='small',animated=false,fromStops=null}={}){
 const safeTotal=Math.max(1,totalStops||13);
 const done=clamp(Number(completedStops)||0,0,safeTotal);
 const from=fromStops===null?done:clamp(Number(fromStops)||0,0,safeTotal);
 const pct=done/safeTotal*100;
 const fromPct=from/safeTotal*100;
 const scale=done/safeTotal;
 const fromScale=from/safeTotal;
 const foamOpacity=done>0 ? Math.min(0.9, 0.28 + scale) : 0;
 const foamY=125*(1-scale);
 const foamFromY=125*(1-fromScale);
 const uid=`beer-${size}-${done}-${from}-${Math.random().toString(36).slice(2,8)}`;
 const cls=['beer-progress',`beer-${size}`,animated?'beer-animated':'',done>=safeTotal?'beer-full':''].filter(Boolean).join(' ');
 return `<div class="${cls}" style="--beer-fill:${pct}%;--beer-from:${fromPct}%;--beer-scale:${scale};--beer-from-scale:${fromScale};--beer-foam-y:${foamY}px;--beer-foam-from-y:${foamFromY}px;--beer-foam-opacity:${foamOpacity}" aria-label="Pivní postup ${done} z ${safeTotal}">
  <svg class="beer-svg" viewBox="0 0 124 154" role="img" aria-hidden="true">
   <defs>
    <clipPath id="${uid}-clip"><path d="M29 19 H83 C88 19 90 22 89 27 L82 133 C81 140 76 144 69 144 H39 C32 144 28 140 27 133 L20 27 C19 22 23 19 29 19 Z"/></clipPath>
    <linearGradient id="${uid}-beerGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe284"/><stop offset=".28" stop-color="#ffc13d"/><stop offset=".68" stop-color="#e79316"/><stop offset="1" stop-color="#bd6810"/></linearGradient>
    <linearGradient id="${uid}-glassGrad" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="rgba(255,255,255,.75)"/><stop offset=".35" stop-color="rgba(255,255,255,.18)"/><stop offset=".72" stop-color="rgba(255,255,255,.42)"/><stop offset="1" stop-color="rgba(255,255,255,.7)"/></linearGradient>
    <linearGradient id="${uid}-shineGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient>
   </defs>
   <g class="beer-mug">
    <path class="beer-handle-fill" d="M84 45 C113 43 116 119 82 114 L83 98 C100 101 101 59 84 61 Z"/>
    <path class="beer-handle-line" d="M84 45 C113 43 116 119 82 114 M84 61 C101 59 100 101 83 98"/>
    <path class="beer-glass-bg" d="M29 19 H83 C88 19 90 22 89 27 L82 133 C81 140 76 144 69 144 H39 C32 144 28 140 27 133 L20 27 C19 22 23 19 29 19 Z"/>
    <g clip-path="url(#${uid}-clip)">
     <rect class="beer-liquid" x="20" y="19" width="70" height="125" fill="url(#${uid}-beerGrad)"/>
     <rect class="beer-liquid-shine" x="29" y="20" width="12" height="125"/>
     <rect class="beer-head" x="20" y="15" width="70" height="14" rx="4"/>
     <ellipse class="beer-surface" cx="55" cy="22" rx="34" ry="4"/>
     <g class="beer-bubbles">
      <circle cx="39" cy="105" r="1.5"/><circle cx="54" cy="88" r="1.2"/><circle cx="70" cy="112" r="1.4"/><circle cx="47" cy="126" r="1.1"/><circle cx="64" cy="72" r="1.3"/>
      <circle cx="35" cy="76" r="1"/><circle cx="74" cy="92" r="1"/><circle cx="58" cy="118" r="1.2"/><circle cx="45" cy="58" r="1"/><circle cx="67" cy="54" r="1.1"/>
     </g>
    </g>
    <path class="beer-glass-overlay" d="M29 19 H83 C88 19 90 22 89 27 L82 133 C81 140 76 144 69 144 H39 C32 144 28 140 27 133 L20 27 C19 22 23 19 29 19 Z"/>
    <path class="beer-outline" d="M29 19 H83 C88 19 90 22 89 27 L82 133 C81 140 76 144 69 144 H39 C32 144 28 140 27 133 L20 27 C19 22 23 19 29 19 Z"/>
    <path class="beer-glass-shine" d="M32 25 C31 55 33 95 35 132"/>
    <path class="beer-glass-shine right" d="M79 26 C78 64 75 103 72 132"/>
    <ellipse class="beer-base" cx="54" cy="145" rx="30" ry="5"/>
   </g>
  </svg>
 </div>`;
}
function beerProgress(done){ return BeerProgress({completedStops:done,totalStops:DATA.stations.length,size:'small',animated:false}); }
function unlockDiary(){ const s=getState(); s.diaryUnlocked=true; saveState(s); addLog('diary_unlocked'); toast('Deník odemčen.'); render(); }
const pendingHints = new Map();
const pendingSolutions = new Map();
async function fetchHintText(id,num){
 const s=getState();
 if(hintText(s,id,num)) return hintText(s,id,num);
 const key=`${id}:${num}`;
 if(pendingHints.has(key)) return pendingHints.get(key);
 const request=backendRequest('hint', {accessCode:s.accessCode || activeAccessCode(), station:id, num, _:Date.now()})
  .then(data=>{
   if(!data?.ok) throw new Error(data?.error || 'hint_failed');
   const latest=getState();
   latest.hintTexts={...(latest.hintTexts||{}),[id]:{...((latest.hintTexts||{})[id]||{}),[num]:data.hint}};
   saveState(latest);
   return data.hint;
  })
  .finally(()=>pendingHints.delete(key));
 pendingHints.set(key, request);
 return request;
}
async function fetchSolutionText(id){
 const s=getState();
 if(solutionText(s,id)) return solutionText(s,id);
 if(pendingSolutions.has(id)) return pendingSolutions.get(id);
 const request=backendRequest('solution', {accessCode:s.accessCode || activeAccessCode(), station:id, _:Date.now()})
  .then(data=>{
   if(!data?.ok) throw new Error(data?.error || 'solution_failed');
   const latest=getState();
   latest.solutionTexts={...(latest.solutionTexts||{}),[id]:data.solution};
   saveState(latest);
   return data.solution;
  })
  .finally(()=>pendingSolutions.delete(id));
 pendingSolutions.set(id, request);
 return request;
}
function prefetchStationHints(id){
 const st=station(id);
 const count=stationHintCount(st);
 if(!count) return;
 for(let num=1; num<=count; num++){
  fetchHintText(id,num).catch(()=>{});
 }
}
function prefetchSolution(id){
 fetchSolutionText(id).catch(()=>{});
}
async function openHint(id,num){
 const s=getState();
 try{
  if(!hintText(s,id,num)) toast('Načítám nápovědu...');
  const hint=await fetchHintText(id,num);
  const latest=getState();
  latest.hintTexts={...(latest.hintTexts||{}),[id]:{...((latest.hintTexts||{})[id]||{}),[num]:hint}};
  latest.hints[id]=Math.max(latest.hints[id]||0,num);
  saveState(latest);
  addLog('hint_opened',{hint:num});
  const hintCount=stationHintCount(station(id));
  if(num<hintCount) fetchHintText(id,num+1).catch(()=>{});
  if(num>=hintCount) prefetchSolution(id);
  returnToGame();
 }catch(e){
  toast('Nápovědu se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.');
 }
}
function revealSolution(id){ const s=getState(); s.hints[id]=stationHintCount(station(id)); saveState(s); addLog('solution_available'); returnToGame(); }
async function openSolution(id, btn){
 const s=getState();
 try{
  if(!solutionText(s,id)) toast('Načítám řešení...');
  const solution=await fetchSolutionText(id);
  const latest=getState();
  latest.solutionTexts={...(latest.solutionTexts||{}),[id]:solution};
  latest.solutions[id]=true;
  saveState(latest);
  addLog('solution_opened');
  returnToGame();
 }catch(e){
  toast('Řešení se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.');
 }
}
function playUnlockFx(){
 try{
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if(!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
 }catch(e){}
}
function markMore(id){ addLog('more_opened',{station:id}); }
function toggleAcc(btn){ btn.closest('.accordion').classList.toggle('open'); }
let jingleAudio = null;
function getJingleAudio(){
 const st=station(5);
 const file=st.jingle || '05_Velke_divadlo_JK_Tyla_audio_znelka.mp3';
 const src='assets/audio/'+encodeURI(file);
 if(!jingleAudio || jingleAudio.dataset.src !== src){
  if(jingleAudio) jingleAudio.pause();
  jingleAudio = new Audio(src);
  jingleAudio.dataset.src = src;
  jingleAudio.preload = 'metadata';
  jingleAudio.onerror = () => toast('Soubor znělky zatím chybí: '+src);
  jingleAudio.onended = () => {
   jingleAudio.currentTime = 0;
   updateJingleButton(false);
  };
 }
 return jingleAudio;
}
function updateJingleButton(isPlaying){
 const btn=document.getElementById('jingleBtn');
 if(btn) btn.textContent = isPlaying ? 'Pozastavit znělku' : 'Přehrát znělku';
}
function toggleJingle(){
 const a=getJingleAudio();
 if(a.paused){
  a.play()
   .then(()=>updateJingleButton(true))
   .catch(()=>toast('Přehrání znělky se nepodařilo.'));
 }else{
  a.pause();
  updateJingleButton(false);
 }
}
function playJingle(){ toggleJingle(); }
function openCode(){ const st=station(getState().currentStation); if(st.id===13){ modal(`<h2>Dokončit hru</h2><p>Zadejte finální slovo z cryptexu.</p><div class="code-row"><input id="codeInput" type="text" placeholder="Zadejte slovo"><button class="btn" onclick="finishCode()">Ověřit</button></div>`); setTimeout(()=>$('#codeInput')?.focus(),50); return; } modal(`<h2>Zadat app-kód</h2><p>App-kód najdete na kartičce uvnitř fyzicky otevřené schránky.</p><div class="code-row"><input id="codeInput" type="text" placeholder="KÓD"><button class="btn" onclick="checkCode()">Ověřit</button></div><p class="small muted">Kontrola ignoruje mezery, velikost písmen a diakritiku.</p>`); setTimeout(()=>$('#codeInput')?.focus(),50); }
async function checkCode(){
 const s=getState(), st=station(s.currentStation), val=normalize($('#codeInput').value);
 let ok=false;
 try{
  const data=await backendRequest('checkStationCode', {accessCode:s.accessCode || activeAccessCode(), station:st.id, value:val, _:Date.now()});
  ok=!!data?.ok;
 }catch(e){
  toast('Kód se nepodařilo ověřit. Zkontrolujte připojení a zkuste to znovu.');
  return;
 }
 if(ok){
  closeModal();
  completeStation();
 } else {
  s.wrong[st.id]=(s.wrong[st.id]||0)+1;
  s.wrongTotal=(s.wrongTotal||0)+1;
  saveState(s);
  addLog('wrong_code',{value:val,count:s.wrong[st.id],total:s.wrongTotal,stationTitle:st.title});
  let msg=DATA.wrongMessages[Math.floor(Math.random()*DATA.wrongMessages.length)];
  if(s.wrong[st.id]===3) msg='Nechci vám do toho mluvit, ale možná by se hodila nápověda.';
  if(s.wrong[st.id]===5) msg='Tahle várka se začíná připalovat. Mrkněte raději na nápovědu, než z toho bude patok.';
  toast(msg);
  $('.modal')?.classList.add('shake');
  setTimeout(()=>$('.modal')?.classList.remove('shake'),450);
 }
}
function completeStation(){
 const s=getState(), st=station(s.currentStation);
 const previousDone = s.completed.length;
 if(!s.completed.includes(st.id)) s.completed.push(st.id);
 addLog('station_completed');
 playUnlockFx();
 const isFinal = st.id>=DATA.stations.length;
 if(isFinal){
  s.finished=true;
  s.finishTime=now();
 } else {
  const nextId=st.id+1;
  s.currentStation=nextId;
  s.unlocked=Math.max(s.unlocked,nextId);

  // Po zadání správného kódu se další zastávka nesmí otevřít rovnou.
  // Vždy se musí nejdřív zobrazit mezistránka s navigací a GPS ověřením.
  delete s[`gpsOk${nextId}`];
  if(s.gpsBypass) s.gpsBypass=s.gpsBypass.filter(x=>x!==nextId);
  if(s.gpsCanBypass) s.gpsCanBypass=s.gpsCanBypass.filter(x=>x!==nextId);
  if(s.gpsMessage) delete s.gpsMessage[nextId];
 }
 saveState(s);
 if(!isFinal) returnToGame();
 app.querySelector('.phone')?.classList.add('wow');
 const next = isFinal ? null : station(s.currentStation);
 const successText = DATA.successMessages[Math.floor(Math.random()*DATA.successMessages.length)];
 const beer = BeerProgress({completedStops:s.completed.length,totalStops:DATA.stations.length,size:'large',animated:true,fromStops:previousDone});
 if(isFinal){
  modal(`<div class="success-card"><h2>${successText}</h2><p>Poslední zámek povolil. Půllitr je plný.</p><div class="success-progress">${beer}</div><button class="btn" onclick="closeModal(); returnToGame()">Zobrazit certifikát</button></div>`, false);
  return;
 }
 modal(`<div class="success-card"><h2>${successText}</h2><p>Výborně! Vaše další zastávka je:</p><h3>${escapeHtml(next.title)}</h3><div class="success-progress">${beer}</div><a class="btn" href="${mapsUrl(next)}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">Navigovat</a><button class="btn secondary" onclick="closeModal(); returnToGame()" style="margin-top:10px">Pokračovat na další zastávku</button></div>`, false);
}
async function finishCode(){
 const s=getState(), st=station(s.currentStation), val=normalize($('#codeInput').value);
 try{
  const data=await backendRequest('checkStationCode', {accessCode:s.accessCode || activeAccessCode(), station:st.id, value:val, _:Date.now()});
  if(data?.ok){
   closeModal();
   completeStation();
  } else toast('Finální slovo nesedí. Zkontrolujte pořadí lahviček.');
 }catch(e){
  toast('Finální slovo se nepodařilo ověřit. Zkontrolujte připojení a zkuste to znovu.');
 }
}
function titleFor(ms){ const h=ms/36e5; if(h<=2.5) return 'Mistři sládkové'; if(h<=3) return 'Grollova pravá ruka'; if(h<=3.5) return 'Pivovarští tovaryši'; if(h<=4) return 'Hledači ztracené várky'; return 'Stateční poutníci za pivem'; }
function renderFinish(){
 const s=getState();
 const total=(s.finishTime||now())-s.startTime;
 const hintCount = Object.values(s.hints || {}).reduce((sum,n)=>sum+(Number(n)||0),0);
 const solutionCount = Object.values(s.solutions || {}).filter(Boolean).length;
 const teamName = s.team || '—';
 const debugClass = CERT_DEBUG ? ' certificate-debug' : '';

 app.innerHTML = shell(`
  <div class="cert-wrap cert-wrap-template">
    <section class="cert-fixed-template${debugClass}" id="cert" aria-label="Certifikát sládkovské odvahy">
      <img class="cert-fixed-bg" src="assets/images/certifikat-bez-titulu.jpg" alt="Certifikát sládkovské odvahy">
      <div id="field-team" class="cert-field cert-field-team" style="${certFieldStyle('team')}">${escapeHtml(teamName)}</div>
      <div id="field-time" class="cert-field cert-field-time" style="${certFieldStyle('time')}">${escapeHtml(fmtTime(total))}</div>
      <div id="field-hints" class="cert-field cert-field-hints" style="${certFieldStyle('hints')}">${escapeHtml(String(hintCount))}</div>
      <div id="field-solutions" class="cert-field cert-field-solutions" style="${certFieldStyle('solutions')}">${escapeHtml(String(solutionCount))}</div>
    </section>
  </div>
  <div class="grid cert-actions no-print" style="margin-top:14px">
    <button class="btn" onclick="downloadCertificate()">Stáhnout certifikát</button>
    <button class="btn secondary" onclick="shareResult()">Sdílet výsledek</button>
    <button class="btn ghost" onclick="openLeaderboard()">Žebříček</button>
  </div>`);
 addLeaderboardOnce();
}



const CERT_DEBUG = false;
const CERT_TEMPLATE_SIZE = { width: 941, height: 1672 };
const CERT_FIELDS = {
  team:      { x: 210, y: 630,  w: 520, h: 92,  font: 30, align: 'center' },
  time:      { x: 449, y: 1025, w: 205, h: 48,  font: 24, align: 'left' },
  hints:     { x: 568, y: 1114, w:  95, h: 48,  font: 24, align: 'left' },
  solutions: { x: 550, y: 1196, w:  95, h: 48,  font: 24, align: 'left' }
};
const CERT_DISPLAY_FIELDS = {
  team: { x: 225, y: 628, w: 490, h: 74, font: 23, align: 'center' }
};
const CERT_DOWNLOAD_OFFSET = {
  time: 5,
  hints: 2,
  solutions: 5
};
const CERT_DOWNLOAD_X_OFFSET = {
  time: 9
};

function certFieldStyle(fieldName){
  const f = CERT_DISPLAY_FIELDS[fieldName] || CERT_FIELDS[fieldName];
  const W = CERT_TEMPLATE_SIZE.width;
  const H = CERT_TEMPLATE_SIZE.height;
  const left = (f.x / W * 100).toFixed(4);
  const top = (f.y / H * 100).toFixed(4);
  const width = (f.w / W * 100).toFixed(4);
  const height = (f.h / H * 100).toFixed(4);
  const font = `clamp(${Math.max(10, Math.round(f.font * 0.55))}px, ${(f.font / W * 100).toFixed(3)}vw, ${f.font}px)`;
  return `left:${left}%;top:${top}%;width:${width}%;height:${height}%;font-size:${font};text-align:${f.align};`;
}

function drawCertificate(data){
 const canvas = document.getElementById('certCanvas');
 if(!canvas) return;
 const ctx = canvas.getContext('2d');
 const img = new Image();
 img.onload = () => {
   const W = canvas.width;
   const H = canvas.height;
   const sx = W / 941;
   const sy = H / 1672;
   const brown = '#2f1a0d';

   ctx.clearRect(0,0,W,H);
   ctx.drawImage(img, 0, 0, W, H);
   ctx.fillStyle = brown;
   ctx.textBaseline = 'middle';

   const fontFor = (weight, size) => `${weight} ${Math.round(size)}px Georgia, serif`;
   const fitFont = (weight, startSize, minSize, text, maxWidth) => {
     let size = startSize;
     while(size >= minSize){
       ctx.font = fontFor(weight, size);
       if(ctx.measureText(text).width <= maxWidth) return size;
       size -= 2;
     }
     return minSize;
   };
   const wrapLines = (text, font, maxWidth) => {
     ctx.font = font;
     const words = String(text || '').split(/\s+/).filter(Boolean);
     const lines = [];
     let line = '';
     for(const word of words){
       const test = line ? `${line} ${word}` : word;
       if(ctx.measureText(test).width <= maxWidth){
         line = test;
       }else{
         if(line) lines.push(line);
         line = word;
       }
     }
     if(line) lines.push(line);
     return lines;
   };
   const drawText = (text, x, y, options={}) => {
     const { align='left', baseline='middle' } = options;
     ctx.textAlign = align;
     ctx.textBaseline = baseline;
     ctx.fillText(String(text ?? ''), x, y);
   };

   // Team name under "Tým" — keep centered where it already sits correctly.
   const teamSize = fitFont('700', 52 * sy, 24 * sy, data.team, 245 * sx);
   ctx.font = fontFor('700', teamSize);
   drawText(data.team, 470 * sx, 690 * sy, { align:'center' });

   // Bottom information rows: values must sit directly in their own rows.
   const valueX = 530 * sx;
   ctx.font = fontFor('700', 20 * sy);
   drawText(data.time, valueX, 1025 * sy);
   drawText(String(data.hints), valueX, 1148 * sy);
   drawText(String(data.solutions), valueX, 1270 * sy);

   // Title in the title row. Keep it directly on the same row as the label.
   let titleSize = 12 * sy;
   let titleFont = fontFor('700', titleSize);
   let titleLines = wrapLines(data.title, titleFont, 180 * sx);
   while(titleLines.length > 2 && titleSize > 10 * sy){
     titleSize -= 1;
     titleFont = fontFor('700', titleSize);
     titleLines = wrapLines(data.title, titleFont, 180 * sx);
   }
   ctx.font = titleFont;
   if(titleLines.length <= 1){
     drawText(titleLines[0] || data.title, 486 * sx, 1348 * sy);
   }else{
     const lineHeight = 13 * sy;
     let y = 1342 * sy;
     for(const line of titleLines.slice(0,2)){
       drawText(line, 486 * sx, y);
       y += lineHeight;
     }
   }
 };
 img.src = data.imageSrc;
}



function adminDate(iso){
 if(!iso) return '—';
 try{
  return new Date(iso).toLocaleString('cs-CZ', {day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 }catch(e){ return '—'; }
}
function adminStationLabel(id){
 const n=Number(id);
 const st=station(n);
 return st ? `${st.id}/13 – ${st.title}` : String(id || '—');
}
function adminRows(){
 const rows=adminLog();
 if(!Array.isArray(rows)) return [];
 return rows
  .filter(row=>row && typeof row === 'object')
  .map(row=>({
   ...row,
   type:String(row.type || ''),
   team:String(row.team || ''),
   time:row.time || '',
   station:row.station || ''
  }));
}
function adminTimeOnly(iso){
 if(!iso) return '—';
 try{
  return new Date(iso).toLocaleTimeString('cs-CZ', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
 }catch(e){ return '—'; }
}
function adminEventName(r){
 const map={
  hint_opened:'Otevřena nápověda',
  solution_opened:'Otevřeno řešení',
  solution_available:'Zpřístupněno řešení',
  more_opened:'Otevřeno „Chci vědět víc“',
  code_success:'Správný app-kód',
  station_completed:'Správný app-kód',
  code_failed:'Špatný app-kód',
  wrong_code:'Špatný app-kód',
  station_unlocked:'Odemčena další zastávka',
  admin_unlock_next:'Odemčena další zastávka',
  gps_bypass:'Ručně obejita GPS kontrola',
  gps_ok:'Ověřena poloha',
  sos_opened:'Použito SOS',
  start:'Spuštěna hra',
  admin_jump:'Přeskočena zastávka',
  admin_unlock_next:'Odemčena další zastávka'
 };
 let label = map[r.type] || r.type || 'Událost';
 if(r.type==='hint_opened' && r.hint) label += ` ${r.hint}`;
 return label;
}
function adminEventDetail(r){
 const parts=[];
 if(r.station) parts.push(`Zastávka ${adminStationLabel(r.station)}`);
 if((r.type==='wrong_code' || r.type==='code_failed') && r.value) parts.push(`Zadaný kód: ${escapeHtml(String(r.value))}`);
 if(r.type==='gps_ok' && r.distance!==undefined) parts.push(`Vzdálenost: ${escapeHtml(String(r.distance))} m`);
 if(r.type==='admin_jump' && r.to) parts.push(`Přesun na: ${adminStationLabel(r.to)}`);
 return parts.join('<br>') || '—';
}
function adminWrongRows(rows){
 return rows.filter(r=>r.type==='wrong_code' || r.type==='code_failed');
}
function adminHintsSummary(s){
 if(!s) return '<h3>Použité nápovědy</h3><p class="small muted">Není spuštěná hra.</p>';
 const hints=s.hints || {};
 const solutions=s.solutions || {};
 const hintTotal=Object.values(hints).reduce((sum,n)=>sum+(Number(n)||0),0);
 const solutionTotal=Object.values(solutions).filter(Boolean).length;
 if(!hintTotal && !solutionTotal) return `<h3>Použité nápovědy</h3><p>Zatím nebyla použita žádná nápověda.</p>`;
 const stationBlocks=DATA.stations.map(st=>{
  const count=Number(hints[st.id]||0);
  const hasSolution=!!solutions[st.id];
  if(!count && !hasSolution) return '';
  const items=[];
  for(let i=1;i<=count;i++) items.push(`<li>Nápověda ${i}</li>`);
  if(hasSolution) items.push('<li>Řešení</li>');
  return `<div class="admin-subcard"><b>${st.id}/13 – ${escapeHtml(st.title)}:</b><ul>${items.join('')}</ul></div>`;
 }).join('');
 return `<h3>Použité nápovědy</h3><p><b>Celkem:</b> ${hintTotal}<br><b>Otevřená řešení:</b> ${solutionTotal}</p>${stationBlocks}`;
}
function adminTeamCard(s, rows){
 if(!s) return `<div class="admin-card"><h3>Aktuální tým</h3><p>Není spuštěná hra.</p></div>`;
 const st=station(s.currentStation);
 const last=rows.length ? rows[rows.length-1] : null;
 const wrongTotal = adminWrongRows(rows).length || Object.values(s.wrong || {}).reduce((sum,n)=>sum+(Number(n)||0),0);
 const hintTotal = Object.values(s.hints || {}).reduce((sum,n)=>sum+(Number(n)||0),0);
 const solutionTotal = Object.values(s.solutions || {}).filter(Boolean).length;
 const status = s.finished ? 'Dokončeno' : 'Hraje';
 const loc = s.lastPos ? `<a href="https://maps.google.com/?q=${s.lastPos.lat},${s.lastPos.lng}" target="_blank" rel="noopener">zobrazit na mapě</a>` : 'není dostupná';
 return `<div class="admin-card"><h3>Aktuální tým</h3>
  <p><b>Název týmu:</b> ${escapeHtml(s.team)}<br>
  <b>Aktuální zastávka:</b> ${st ? `${st.id}/13 – ${escapeHtml(st.title)}` : '—'}<br>
  <b>Čas ve hře:</b> ${fmtTime((s.finishTime||now())-s.startTime)}<br>
  <b>Stav:</b> ${status}<br>
  <b>Použité nápovědy celkem:</b> ${hintTotal}<br>
  <b>Otevřená řešení celkem:</b> ${solutionTotal}<br>
  <b>Chybné app-kódy celkem:</b> ${wrongTotal}<br>
  <b>Poslední aktivita:</b> ${last ? adminDate(last.time) : '—'}<br>
  <b>Poslední GPS poloha:</b> ${loc}</p></div>`;
}
function adminWrongHtml(s, rows){
 const wrongRows=adminWrongRows(rows);
 const wrongTotal=wrongRows.length || (s ? Object.values(s.wrong || {}).reduce((sum,n)=>sum+(Number(n)||0),0) : 0);
 if(!wrongRows.length){
  return `<h3>Chybné app-kódy</h3><p><b>Celkem:</b> ${wrongTotal}</p><p class="small muted">Zatím žádné chybné app-kódy.</p>`;
 }
 return `<h3>Chybné app-kódy</h3><p><b>Celkem:</b> ${wrongTotal}</p><table class="admin-table"><tr><th>Čas</th><th>Zastávka</th><th>Zadaný kód</th></tr>${wrongRows.slice().reverse().map(r=>`<tr><td>${adminTimeOnly(r.time)}</td><td>${adminStationLabel(r.station)}</td><td>${escapeHtml(String(r.value||''))}</td></tr>`).join('')}</table>`;
}
function adminLogHtml(rows){
 if(!rows.length) return '<h3>Log událostí</h3><p class="small muted">Zatím nejsou zaznamenané žádné události.</p>';
 return `<h3>Log událostí</h3><table class="admin-table"><tr><th>Čas</th><th>Událost</th><th>Detail</th></tr>${rows.slice(-80).reverse().map(r=>`<tr><td>${adminDate(r.time)}</td><td>${escapeHtml(adminEventName(r))}</td><td>${adminEventDetail(r)}</td></tr>`).join('')}</table>`;
}
function adminStationSelect(){
 return `<div class="admin-card"><h3>Náhled zastávek</h3><p class="small muted">Otevře obsah tak, jak ho vidí hráči, ale nezmění rozehranou hru.</p><div class="grid two">${DATA.stations.map(st=>`<button class="btn secondary" onclick="adminPreviewStation(${st.id})">${st.id}/13 ${escapeHtml(st.title)}</button>`).join('')}</div></div>`;
}
function adminPanelHtml(){
 const s=getState();
 const rows=adminRows();
 const safeCard=(title, fn)=>{
  try{ return fn(); }
  catch(e){ console.error('Admin section failed:', title, e); return `<div class="admin-card"><h3>${escapeHtml(title)}</h3><p class="small muted">Tuto část se nepodařilo načíst.</p></div>`; }
 };
 return `<h2>Admin panel</h2>
  <div class="grid two admin-actions">
   <button class="btn secondary" onclick="loadOnlineAdmin()">Obnovit online přehled</button>
  </div>
  ${safeCard('Náhled zastávek', ()=>adminStationSelect())}
  <div id="onlineAdminPanel" class="admin-card"><h3>Online týmy</h3><p class="small muted">Načítám online přehled týmů...</p></div>
  <button class="btn ghost admin-export" onclick="exportData()">Stáhnout technická data</button>`;
}
function openAdminPanel(){
 window._adminOk=true;
 try{
  modal(adminPanelHtml());
  loadOnlineAdmin();
 }catch(e){
  console.error(e);
  modal(`<h2>Admin panel</h2><p>Admin panel se nepodařilo celý sestavit.</p>${adminStationSelect()}<button class="btn ghost" onclick="exportData()">Stáhnout technická data</button>`, true);
 }
}
function safeJson(value, fallback){
 if(!value) return fallback;
 if(typeof value !== 'string') return value;
 try{ return JSON.parse(value); }catch(e){ return fallback; }
}
function onlineTeamSummary(team){
 const hints=safeJson(team.hints, team.hints || {});
 const solutions=safeJson(team.solutions, team.solutions || {});
 const completed=safeJson(team.completed, team.completed || []);
 const lastPos=safeJson(team.lastPos, team.lastPos || null);
 const hintTotal=Object.values(hints || {}).reduce((sum,n)=>sum+(Number(n)||0),0);
 const solutionTotal=Object.values(solutions || {}).filter(Boolean).length;
 const currentId=Number(team.currentStation || 1);
 const st=station(currentId);
 const pos=lastPos?.lat
  ? `<a href="https://maps.google.com/?q=${lastPos.lat},${lastPos.lng}" target="_blank" rel="noopener">${Number(lastPos.lat).toFixed(6)}, ${Number(lastPos.lng).toFixed(6)}</a>`
  : 'není dostupná';
 return `<div class="admin-subcard">
  <h4>${escapeHtml(team.team || 'Bez názvu')}</h4>
  <p><b>Přístupový kód:</b> ${escapeHtml(team.accessCode || '—')}<br>
  <b>Aktuální zastávka:</b> ${currentId}/13 – ${escapeHtml(team.stationTitle || st?.title || '—')}<br>
  <b>Dokončené zastávky:</b> ${Array.isArray(completed) ? completed.length : 0}<br>
  <b>Nápovědy celkem:</b> ${hintTotal}<br>
  <b>Řešení celkem:</b> ${solutionTotal}<br>
  <b>Poslední GPS:</b> ${pos}<br>
  <b>Poslední aktualizace:</b> ${adminDate(team.updatedAt)}</p>
 </div>`;
}
function onlineEventsHtml(events, teams=[]){
 const groups=new Map();
 for(const team of teams){
  const key=String(team.accessCode || team.id || team.team || 'bez-kodu');
  groups.set(key, {label:`${team.team || 'Bez názvu'} (${team.accessCode || 'bez kódu'})`, events:[]});
 }
 for(const e of events || []){
  const detail=safeJson(e.detail, {});
  const key=String(e.accessCode || detail.accessCode || e.teamId || detail.teamId || e.team || detail.team || 'bez-kodu');
  if(!groups.has(key)) groups.set(key, {label:`${e.team || detail.team || 'Bez názvu'} (${e.accessCode || detail.accessCode || 'bez kódu'})`, events:[]});
  groups.get(key).events.push({...e, detail});
 }
 if(!groups.size) return '<p class="small muted">Zatím nejsou online události.</p>';
 return [...groups.values()].map(group=>{
  const rows=group.events
   .slice(-80)
   .reverse()
   .map(e=>{
    const detail=e.detail || {};
    const type=detail.type || e.type || 'Událost';
    const stationNo=detail.station || e.station || '';
    return `<tr><td>${adminDate(e.time)}</td><td>${escapeHtml(adminEventName({type, hint:detail.hint}))}</td><td>${stationNo ? adminStationLabel(stationNo) : '—'}</td></tr>`;
   }).join('');
  const body=rows
   ? `<div style="overflow:auto"><table class="admin-table"><tr><th>Čas</th><th>Událost</th><th>Zastávka</th></tr>${rows}</table></div>`
   : '<p class="small muted">Zatím žádné kliknutí v online logu.</p>';
  return `<div class="admin-subcard"><h4>${escapeHtml(group.label)}</h4>${body}</div>`;
 }).join('');
}
async function loadOnlineAdmin(){
 const panel=$('#onlineAdminPanel');
 if(!panel) return;
 if(!monitorEndpoint()){
  panel.innerHTML='<h3>Online týmy</h3><p class="small muted">Online monitoring zatím není nastavený. Aby admin viděl všechny týmy ze všech zařízení, je potřeba doplnit URL Google Apps Scriptu do gameMonitorEndpoint v game-data.js.</p>';
  return;
 }
 panel.innerHTML='<h3>Online týmy</h3><p class="small muted">Načítám online přehled týmů...</p>';
 try{
  const adminPassword=window._adminPass || '';
  const data=await loadJsonp(monitorUrl('admin', {adminPassword, _: Date.now()}));
  if(data?.error === 'unauthorized') throw new Error('Admin heslo nebylo přijato online skriptem.');
  const teams=Array.isArray(data?.teams) ? data.teams : (Array.isArray(data?.rows?.teams) ? data.rows.teams : []);
  const events=Array.isArray(data?.events) ? data.events : (Array.isArray(data?.rows?.events) ? data.rows.events : []);
  const teamsHtml=teams.length ? teams.map(onlineTeamSummary).join('') : '<p class="small muted">Zatím není online žádný tým.</p>';
  panel.innerHTML=`<h3>Online týmy</h3>${teamsHtml}<h3>Časová osa kliknutí podle týmů</h3>${onlineEventsHtml(events, teams)}<button class="btn ghost admin-export" style="margin-top:10px" onclick="loadOnlineAdmin()">Obnovit</button>`;
 }catch(e){
  console.error(e);
  const detail=escapeHtml(e?.message || 'Neznámá chyba načtení.');
  panel.innerHTML=`<h3>Online týmy</h3><p class="small muted">Online přehled se nepodařilo načíst. Detail: ${detail}</p><p class="small muted">Pokud je zde „JSONP failed“ nebo „JSONP timeout“, je potřeba znovu nasadit aktuální Google Apps Script jako webovou aplikaci pro všechny uživatele.</p><button class="btn ghost admin-export" style="margin-top:10px" onclick="loadOnlineAdmin()">Zkusit znovu</button>`;
 }
}
window.loadOnlineAdmin = loadOnlineAdmin;

async function adminLogin(event){
 if(event) event.preventDefault();
 try{
  const input=$('#adminPass');
  const error=$('#adminLoginError');
  const pass = (input?.value || '').trim();
  if(error){ error.style.display='none'; error.textContent=''; }
  if(!window._adminOk){
   const data=await loadJsonp(monitorUrl('admin', {adminPassword:pass, _: Date.now()}));
   if(data?.error === 'unauthorized' || data?.ok === false){
    if(error){ error.textContent='Špatné heslo.'; error.style.display='block'; }
    if(input){ input.classList.add('shake'); setTimeout(()=>input.classList.remove('shake'),450); input.focus(); }
    return toast('Špatné heslo.');
   }
   window._adminOk=true;
  }
  if(pass) window._adminPass=pass;
  openAdminPanel();
 }catch(e){
  console.error(e);
  const error=$('#adminLoginError');
  if(error){ error.textContent='Admin panel se nepodařilo otevřít. Zkuste obnovit stránku.'; error.style.display='block'; }
  modal(`<h2>Admin panel</h2><p>Heslo bylo přijato, ale detailní přehled se nepodařilo sestavit.</p>${adminStationSelect()}<div id="onlineAdminPanel" class="admin-card"><h3>Online týmy</h3><p class="small muted">Načítám online přehled týmů...</p></div><button class="btn ghost" onclick="exportData()">Stáhnout technická data</button>`, true);
  loadOnlineAdmin();
 }
 return false;
}
window.adminLogin = adminLogin;
const adminStationCache = new Map();
function activeBackendAccessCode(){
 const accessCode=(getState()?.accessCode || activeAccessCode() || '').trim();
 if(!accessCode) throw new Error('missing_access_code');
 return accessCode;
}
async function fetchAdminStationHints(id){
 const cached=adminStationCache.get(id);
 if(cached?.hints) return cached.hints;
 const accessCode=activeBackendAccessCode();
 const hintCount=stationHintCount(station(id));
 const hintRequests=Array.from({length:hintCount}, (_,i)=>backendRequest('hint', {accessCode, station:id, num:i+1, _:Date.now()}));
 const hintResults=await Promise.all(hintRequests);
 const hints=hintResults.map(data=>{
  if(!data?.ok) throw new Error(data?.error || 'admin_hint_failed');
  return data.hint;
 });
 adminStationCache.set(id, {...(cached||{}), hints});
 return hints;
}
async function fetchAdminStationSolution(id){
 const cached=adminStationCache.get(id);
 if(cached && Object.prototype.hasOwnProperty.call(cached, 'solution')) return cached.solution;
 const accessCode=activeBackendAccessCode();
 const solutionData=await backendRequest('solution', {accessCode, station:id, _:Date.now()});
 if(!solutionData?.ok) throw new Error(solutionData?.error || 'admin_solution_failed');
 const solution=solutionData.solution;
 adminStationCache.set(id, {...(cached||{}), solution});
 return solution;
}
function renderAdminHints(st, hints=[], solution='', solutionLoading=false){
 const hintItems=Array.isArray(hints) ? hints : [];
 const hintHtml=hintItems.map((hint,i)=>`<div class="accordion open"><button class="acc-head" onclick="toggleAcc(this)">Nápověda ${i+1} <span>⌄</span></button><div class="acc-body">${renderHintContent(hint)}</div></div>`).join('');
 const solutionHtml=solution ? `<div class="accordion open"><button class="acc-head" onclick="toggleAcc(this)">Řešení <span>⌄</span></button><div class="acc-body">${renderSolutionContent(solution)}</div></div>` : '';
 const loadingHtml=solutionLoading ? '<div class="admin-card"><p>Načítám řešení...</p></div>' : '';
 if(!hintHtml && !solutionHtml && !loadingHtml) return '<div class="admin-card"><p class="small muted">Nápovědy ani řešení se nepodařilo načíst.</p></div>';
 return `${hintHtml}${solutionHtml}${loadingHtml}`;
}
async function adminPreviewStation(id=null){
 if(id===null){
  const n=prompt('Číslo zastávky 1–13:');
  if(n===null) return;
  id=n;
 }
 id=clamp(parseInt(id,10)||1,1,13);
 const st=station(id);
 let intro = st.intro || '';
 if(st.id===1 && intro.includes('Po odemčení:')) intro = intro.split('Po odemčení:').pop();
 const more = st.more ? `<div class="accordion open"><button class="acc-head" onclick="toggleAcc(this)">Chci vědět víc <span>⌄</span></button><div class="acc-body">${st.audio?`<audio controls preload="none" src="assets/audio/${encodeURI(st.audio)}"></audio>`:''}<div style="margin-top:10px">${ptxt(st.more)}</div></div></div>` : '';
 const shellHtml=(secretHtml)=>`<h2>Náhled zastávky ${id}/13</h2><h3>${escapeHtml(st.title)}</h3><p class="small muted">Tento náhled nemění rozehranou hru žádného týmu.</p><div class="grid two admin-actions"><button class="btn secondary" onclick="adminPreviewWrongCode(${id})">Test špatného kódu</button><button class="btn secondary" onclick="adminPreviewCorrectCode(${id})">Test správného kódu</button><button class="btn secondary" onclick="adminPreviewBeer(${id})">Test půllitru</button><button class="btn secondary" onclick="adminPreviewCertificate()">Test certifikátu</button></div>${stationImage(st, false)}${introPanel(st, false, intro)}${more}${secretHtml}<div class="admin-card"><p><b>Souřadnice:</b><br>${st.coords.lat}, ${st.coords.lng}</p></div><button class="btn ghost" onclick="openAdminPanel()">Zpět do adminu</button>`;
 const token=`${id}-${Date.now()}`;
 window._adminPreviewToken=token;
 const updatePreview=secretHtml=>{
  if(window._adminPreviewToken===token) modal(shellHtml(secretHtml), false);
 };
 const cached=adminStationCache.get(id);
 if(cached?.hints){
  updatePreview(renderAdminHints(st, cached.hints, cached.solution, !Object.prototype.hasOwnProperty.call(cached, 'solution')));
 }else{
  updatePreview('<div class="admin-card"><p>Načítám nápovědy...</p></div>');
 }
 try{
  const hints=await fetchAdminStationHints(id);
  const latest=adminStationCache.get(id) || {};
  updatePreview(renderAdminHints(st, hints, latest.solution, !Object.prototype.hasOwnProperty.call(latest, 'solution')));
  const solution=await fetchAdminStationSolution(id);
  updatePreview(renderAdminHints(st, hints, solution, false));
 }catch(e){
  console.error(e);
  updatePreview('<div class="admin-card"><p class="small muted">Nápovědy a řešení se nepodařilo načíst. Zkontrolujte připojení a zkuste otevřít náhled znovu.</p></div>');
 }
}
window.adminPreviewStation = adminPreviewStation;
window.openAdminPanel = openAdminPanel;
function adminPreviewWrongCode(id){
 const st=station(id);
 const msg=DATA.wrongMessages?.[0] || 'Kód nesedí. Zkuste to znovu.';
 modal(`<h2>Test špatného kódu</h2><p class="small muted">Simulace pro admina, nemění hru týmu.</p><div class="card error"><p><b>Zastávka:</b> ${id}/13 – ${escapeHtml(st.title)}</p><p>${escapeHtml(msg)}</p></div><button class="btn ghost" onclick="adminPreviewStation(${id})">Zpět na zastávku</button>`, false);
}
function adminPreviewCorrectCode(id){
 const isFinal=id>=DATA.stations.length;
 const next=isFinal ? null : station(id+1);
 const successText=DATA.successMessages?.[0] || 'Výborně!';
 const beer=BeerProgress({completedStops:id,totalStops:DATA.stations.length,size:'large',animated:true,fromStops:Math.max(0,id-1)});
 if(isFinal){
  modal(`<div class="success-card"><h2>${escapeHtml(successText)}</h2><p>Poslední zámek povolil. Půllitr je plný.</p><div class="success-progress">${beer}</div><button class="btn" onclick="adminPreviewCertificate()">Zobrazit certifikát</button><button class="btn ghost" style="margin-top:10px" onclick="adminPreviewStation(${id})">Zpět na zastávku</button></div>`, false);
  return;
 }
 modal(`<div class="success-card"><h2>${escapeHtml(successText)}</h2><p>Výborně! Vaše další zastávka je:</p><h3>${escapeHtml(next.title)}</h3><div class="success-progress">${beer}</div><a class="btn" href="${mapsUrl(next)}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">Navigovat</a><button class="btn secondary" onclick="adminPreviewStation(${id+1})" style="margin-top:10px">Pokračovat na další zastávku</button><button class="btn ghost" onclick="adminPreviewStation(${id})" style="margin-top:10px">Zpět na zastávku</button></div>`, false);
}
function adminPreviewBeer(id){
 const beer=BeerProgress({completedStops:id,totalStops:DATA.stations.length,size:'large',animated:true,fromStops:Math.max(0,id-1)});
 modal(`<div class="success-card"><h2>Test animace půllitru</h2><p class="small muted">Simulace pro admina, nemění hru týmu.</p><div class="success-progress">${beer}</div><button class="btn ghost" onclick="adminPreviewStation(${id})">Zpět na zastávku</button></div>`, false);
}
function adminPreviewCertificate(){
 const data={team:'Testovací tým', time:'3:12:45', hints:4, solutions:1};
 modal(`<h2>Test certifikátu</h2><p class="small muted">Náhled pro admina, nemění hru týmu.</p><div class="cert-wrap cert-wrap-template"><section class="cert-fixed-template" aria-label="Certifikát sládkovské odvahy"><img class="cert-fixed-bg" src="assets/images/certifikat-bez-titulu.jpg" alt="Certifikát sládkovské odvahy"><div id="field-team" class="cert-field cert-field-team" style="${certFieldStyle('team')}">${escapeHtml(data.team)}</div><div id="field-time" class="cert-field cert-field-time" style="${certFieldStyle('time')}">${escapeHtml(data.time)}</div><div id="field-hints" class="cert-field cert-field-hints" style="${certFieldStyle('hints')}">${escapeHtml(String(data.hints))}</div><div id="field-solutions" class="cert-field cert-field-solutions" style="${certFieldStyle('solutions')}">${escapeHtml(String(data.solutions))}</div></section></div><button class="btn ghost" style="margin-top:14px" onclick="openAdminPanel()">Zpět do adminu</button>`, false);
}
window.adminPreviewWrongCode = adminPreviewWrongCode;
window.adminPreviewCorrectCode = adminPreviewCorrectCode;
window.adminPreviewBeer = adminPreviewBeer;
window.adminPreviewCertificate = adminPreviewCertificate;
function adminJump(){ adminPreviewStation(); }
function adminUnlockNext(){
 toast('Admin náhled už nemění rozehranou hru týmu.');
 adminPreviewStation();
}
function resetGame(){ if(confirm('Opravdu resetovat lokální hru pro aktuální přístupový kód?')){ localStorage.removeItem(stateKeyForCode(activeAccessCode())); localStorage.removeItem(LS_KEY); localStorage.removeItem(ADMIN_KEY); closeModal(); renderStart(); } }
function leaderboardKey(){ return 'grollLeaderboard.v1'; }
function leaderboardEndpoint(){ return String(window.GAME_DATA?.leaderboardEndpoint || '').trim(); }
function buildLeaderboardEntry(){
 const s=getState();
 if(!s || !s.finished) return null;
 const total=(s.finishTime||now())-s.startTime;
 const hintCount = Object.values(s.hints || {}).reduce((sum,n)=>sum+(Number(n)||0),0);
 const solutionCount = Object.values(s.solutions || {}).filter(Boolean).length;
 return {
  id:s.id || ('team-'+(s.team||'')+'-'+(s.startTime||now())),
  team:s.team || 'Bez názvu',
  total,
  hints:hintCount,
  solutions:solutionCount,
  title:titleFor(total),
  date:new Date(s.finishTime||now()).toISOString()
 };
}
function localLeaderboardRows(){
 let rows=[];
 try{ rows=JSON.parse(localStorage.getItem(leaderboardKey())||'[]'); }catch(e){ rows=[]; }
 return rows.filter(Boolean);
}
function saveLocalLeaderboard(entry){
 if(!entry) return;
 const rows=localLeaderboardRows();
 const exists=rows.some(r=>r && r.id===entry.id);
 if(!exists){
  rows.push(entry);
  rows.sort((a,b)=>(a.total||0)-(b.total||0));
  localStorage.setItem(leaderboardKey(), JSON.stringify(rows.slice(0,50)));
 }
}
function leaderboardUrl(action, params={}){
 const endpoint=leaderboardEndpoint();
 if(!endpoint) return '';
 const url=new URL(endpoint);
 url.searchParams.set('action', action);
 for(const [key,value] of Object.entries(params)){
  if(value!==undefined && value!==null) url.searchParams.set(key, String(value));
 }
 return url.toString();
}
async function addLeaderboardOnce(){
 const entry=buildLeaderboardEntry();
 if(!entry) return;
 saveLocalLeaderboard(entry);
 const url=leaderboardUrl('add', entry);
 if(!url) return;
 fireAndForget(url);
}
async function fetchOnlineLeaderboard(){
 const url=leaderboardUrl('list');
 if(!url) return null;
 const data=await loadJsonp(url);
 return Array.isArray(data) ? data : (Array.isArray(data.rows) ? data.rows : []);
}
async function openLeaderboard(){
 let rows=localLeaderboardRows();
 let sourceText = leaderboardEndpoint()
  ? 'Společný online žebříček výsledků všech týmů.'
  : 'Společný online žebříček zatím není nastavený. Dočasně se zobrazují jen výsledky uložené v tomto zařízení.';
 if(leaderboardEndpoint()){
  try{
   const onlineRows=await fetchOnlineLeaderboard();
   if(onlineRows) rows=onlineRows;
  }catch(e){
   console.warn('Online leaderboard load failed', e);
   sourceText='Online žebříček se teď nepodařilo načíst. Zobrazuji záložní výsledky uložené v tomto zařízení.';
  }
 }
 rows=rows.filter(Boolean).sort((a,b)=>(a.total||0)-(b.total||0));
 if(!rows.length){
  modal(`<h2>Žebříček</h2><p>Zatím tu není žádný zapsaný výsledek.</p><p class="small muted">${sourceText}</p>`);
  return;
 }
 const table = rows.slice(0,20).map((r,i)=>`<tr><td>${i+1}.</td><td>${escapeHtml(r.team||'—')}</td><td>${fmtTime(r.total||0)}</td><td>${escapeHtml(r.title||'—')}</td></tr>`).join('');
 modal(`<h2>Žebříček</h2><div style="overflow:auto"><table class="leaderboard-table"><thead><tr><th>Pořadí</th><th>Tým</th><th>Čas</th><th>Titul</th></tr></thead><tbody>${table}</tbody></table></div><p class="small muted" style="margin-top:10px">${sourceText}</p>`);
}
async function shareResult(){
 const s=getState();
 if(!s || !s.finished){ toast('Výsledek zatím není k dispozici.'); return; }
 const total=(s.finishTime||now())-s.startTime;
 const text=`Tým ${s.team} dokončil Grollovu zlatou stopu za ${fmtTime(total)} a získal titul ${titleFor(total)}.`;
 modal(`<h2>Sdílet výsledek</h2><p>${escapeHtml(text)}</p><div class="share-grid">
  <button class="share-btn native" onclick="shareCertificateNative()">Sdílet v telefonu</button>
  <a class="share-btn facebook" href="${socialUrl('facebook', text)}" target="_blank" rel="noopener">Facebook</a>
  <a class="share-btn whatsapp" href="${socialUrl('whatsapp', text)}" target="_blank" rel="noopener">WhatsApp</a>
  <a class="share-btn messenger" href="${socialUrl('messenger', text)}" target="_blank" rel="noopener">Messenger</a>
  <button class="share-btn instagram" onclick="shareInstagramHint()">Instagram</button>
 </div><p class="small muted share-note">Nejlepší volba je „Sdílet v telefonu“. Mobil pak nabídne dostupné aplikace, například Facebook, Instagram nebo zprávy. Přiloží se i obrázek certifikátu, pokud to telefon podporuje.</p><button class="btn ghost" style="margin-top:14px" onclick="closeModal()">Zpět do hry</button>`, false);
}

function exportData(){ const blob=new Blob([JSON.stringify({state:getState(),log:adminLog(),leaderboard:JSON.parse(localStorage.getItem('grollLeaderboard.v1')||'[]')},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='grollova-cesta-export.json'; a.click(); }
function certificateData(){
 const s=getState();
 if(!s || !s.finished) return null;
 const total=(s.finishTime||now())-s.startTime;
 return {
  team:s.team || 'Tým',
  time:fmtTime(total),
  hints:Object.values(s.hints || {}).reduce((sum,n)=>sum+(Number(n)||0),0),
  solutions:Object.values(s.solutions || {}).filter(Boolean).length,
  title:titleFor(total),
  imageSrc:'assets/images/certifikat-bez-titulu.jpg'
 };
}
function loadImage(src){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=reject;
  img.src=src;
 });
}
function certFileName(){
 const s=getState();
 const team=(s?.team || 'tym').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase() || 'tym';
 return `grollova-zlata-stopa-certifikat-${team}.png`;
}
function fitCanvasFont(ctx, weight, startSize, minSize, text, maxWidth){
 let size=startSize;
 while(size>=minSize){
  ctx.font=`${weight} ${size}px Georgia, "Times New Roman", serif`;
  if(ctx.measureText(String(text || '')).width <= maxWidth) return size;
  size-=2;
 }
 return minSize;
}
async function createCertificateBlob(){
 const data=certificateData();
 if(!data) throw new Error('Certificate data missing');
 const canvas=document.createElement('canvas');
 canvas.width=CERT_TEMPLATE_SIZE.width;
 canvas.height=CERT_TEMPLATE_SIZE.height;
 const ctx=canvas.getContext('2d');
 const bg=await loadImage(data.imageSrc);
 ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
 ctx.fillStyle='#2f1a0d';
 ctx.textBaseline='middle';
 const drawField=(name, text)=>{
  const f=CERT_FIELDS[name];
  const centerY=f.y + f.h / 2 + (CERT_DOWNLOAD_OFFSET[name] || 0);
  const weight=700;
  const size=name==='team' ? fitCanvasFont(ctx, weight, f.font, 22, text, f.w) : f.font;
  ctx.font=`${weight} ${size}px Georgia, "Times New Roman", serif`;
  ctx.textAlign=f.align || 'left';
  const x=(f.align==='center' ? f.x + f.w / 2 : f.x) + (CERT_DOWNLOAD_X_OFFSET[name] || 0);
  ctx.fillText(String(text ?? ''), x, centerY);
 };
 drawField('team', data.team);
 drawField('time', data.time);
 drawField('hints', data.hints);
 drawField('solutions', data.solutions);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('Canvas export failed')), 'image/png'));
}
async function downloadCertificate(){
 try{
  const blob=await createCertificateBlob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=certFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  toast('Certifikát se stáhl jako barevný obrázek.');
 }catch(e){
  console.error(e);
  toast('Certifikát se nepodařilo stáhnout.');
 }
}
function socialUrl(type, text){
 const pageUrl='https://hrava-plzen.cz';
 const url=encodeURIComponent(pageUrl);
 const msg=encodeURIComponent(`${text}\n${pageUrl}`);
 if(type==='facebook') return `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${msg}`;
 if(type==='whatsapp') return `https://wa.me/?text=${msg}`;
 if(type==='messenger') return `fb-messenger://share/?link=${url}`;
 return '#';
}
async function shareCertificateNative(){
 const s=getState();
 if(!s || !s.finished){ toast('Výsledek zatím není k dispozici.'); return; }
 const total=(s.finishTime||now())-s.startTime;
 const text=`Tým ${s.team} dokončil Grollovu zlatou stopu za ${fmtTime(total)} a získal titul ${titleFor(total)}.`;
 try{
  const blob=await createCertificateBlob();
  const file=new File([blob], certFileName(), {type:'image/png'});
  if(navigator.canShare?.({files:[file]}) && navigator.share){
   await navigator.share({title:'Grollova zlatá stopa', text, files:[file]});
   return;
  }
  if(navigator.share){
   await navigator.share({title:'Grollova zlatá stopa', text, url:'https://hrava-plzen.cz'});
   return;
  }
  await navigator.clipboard.writeText(text);
  toast('Text výsledku byl zkopírován do schránky.');
 }catch(e){
  console.error(e);
  toast('Sdílení se nepodařilo. Zkuste stáhnout certifikát.');
 }
}
async function shareInstagramHint(){
 await downloadCertificate();
 toast('Pro Instagram nahrajte stažený certifikát jako příspěvek nebo příběh.');
}
function printCertificate(){
 downloadCertificate();
}
window.addEventListener('afterprint',()=>document.body.classList.remove('printing-certificate'));
function openSOS(){
 const s=getState();
 if(s) addLog('sos_opened');
 const pos = s?.lastPos ? `<p class="small"><b>Poslední známá poloha:</b><br>${s.lastPos.lat.toFixed(6)}, ${s.lastPos.lng.toFixed(6)}</p>` : '<p class="small muted">Poloha zatím není uložená. Pokud potřebujete pomoc, zavolejte nebo napište správci hry.</p>';
 modal(`<h2>SOS</h2><p>Pokud nastal technický problém, nejste si jistí dalším postupem nebo potřebujete pomoc správce hry, použijte kontakty níže.</p>${pos}<div class="menu-list">
  <a class="btn" href="tel:+420737256827" style="display:block;text-align:center;text-decoration:none">Zavolat správci</a>
  <a class="btn secondary" href="sms:+420737256827" style="display:block;text-align:center;text-decoration:none">Poslat SMS</a>
  <button class="btn ghost" onclick="closeModal()">Zpět do hry</button>
 </div>`, false);
}
function openRulesModal(){
 modal(`<h2>Pravidla hry</h2><div class="rules-modal">${ptxt(rulesText())}</div><button class="btn ghost" onclick="closeModal()">Zpět do hry</button>`, false);
}
function openMenu(){
 const s=getState();
 const stationLine = s && !s.finished ? `<p class="small muted">Aktuální zastávka: ${s.currentStation}/${DATA.stations.length}</p>` : '';
 modal(`<h2>Menu</h2>${stationLine}<div class="menu-list">
 <button class="btn secondary" onclick="closeModal(); openRulesModal()">Pravidla hry</button>
  <button class="btn danger" onclick="closeModal(); openSOS()">SOS pomoc</button>
  <button class="btn secondary" onclick="closeModal(); openLeaderboard()">Žebříček</button>
  <button class="btn ghost" onclick="closeModal(); backToWebsite()">Zpět na web</button>
  <button class="btn" onclick="closeModal(); returnToGame()">Zpět do hry</button>
 </div>`, false);
}
function modal(html, showClose=true){ closeModal(); const d=document.createElement('div'); d.className='modal-back'; d.innerHTML=`<div class="modal">${html}${showClose?`<button class="btn ghost" style="margin-top:14px" onclick="closeModal()">Zpět do hry</button>`:''}</div>`; d.addEventListener('click',e=>{ if(e.target===d && showClose) closeModal(); }); document.body.appendChild(d); }
function closeModal(){ document.querySelectorAll('.modal-back').forEach(x=>x.remove()); }
let timerInt; function startTimer(){ clearInterval(timerInt); const tick=()=>{ const s=getState(); const el=$('#timer'); if(s&&el) el.textContent=fmtTime((s.finishTime||now())-s.startTime);}; tick(); timerInt=setInterval(tick,1000); }
function cacheOffline(){ if(!('serviceWorker' in navigator)) return toast('Service worker není dostupný.'); navigator.serviceWorker.ready.then(reg=>{ reg.active?.postMessage({type:'CACHE_ALL'}); toast('Stahování obsahu spuštěno.'); }); }
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
render();




