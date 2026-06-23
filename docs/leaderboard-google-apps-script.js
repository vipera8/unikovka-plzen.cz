const ADMIN_PASSWORD_PROPERTY = 'ADMIN_PASSWORD';
const LEAD_NOTIFICATION_EMAIL = 'hravaplzen@gmail.com';
const SHEETS = {
  leaderboard: 'Leaderboard', teams: 'Teams', events: 'Events',
  accessCodes: 'AccessCodes', leads: 'Leads', secrets: 'StationSecrets',
  secretImages: 'SecretImages'
};
const HEADERS = {
  accessCodes: ['accessCode','customerName','email','phone','orderType','status','createdAt','assignedAt','notes','teamId','teamName','startedAt','lastUsedAt'],
  leads: ['time','type','name','email','phone','payload','status'],
  secrets: ['stationId','title','unlockCode','hintsJson','solutionJson'],
  secretImages: ['fileName','driveFileId','mimeType','notes'],
  teams: ['id','team','accessCode','currentStation','stationTitle','startTime','updatedAt','finished','finishTime','hints','solutions','wrong','wrongTotal','completed','lastPos'],
  events: ['time','teamId','team','accessCode','type','eventName','station','stationTitle','hint','value','detail'],
  leaderboard: ['id','team','total','hints','solutions','title','date']
};

function onOpen(){ SpreadsheetApp.getUi().createMenu('Hravá Plzeň').addItem('Připravit tabulky','setupSheets').addItem('Vygenerovat 10 volných kódů','generateTenFreeCodes').addToUi(); }
function setupSheets(){ Object.keys(SHEETS).forEach(k=>getSheet_(SHEETS[k], HEADERS[k])); }
function generateTenFreeCodes(){ setupSheets(); const codes=createAccessCodes_({count:10,status:'active',orderType:'volny'}); SpreadsheetApp.getUi().alert('Vygenerované kódy:\n'+codes.join('\n')); }

function doGet(e){
  const a=String(e.parameter.action||'list');
  if(a==='validateAccessCode') return validateAccessCode_(e);
  if(a==='checkStationCode') return checkStationCode_(e);
  if(a==='hint') return hint_(e);
  if(a==='solution') return solution_(e);
  if(a==='lead') return saveLead_(e);
  if(a==='generateCodes') return requireAdmin_(e,()=>json_({ok:true,codes:createAccessCodes_(e.parameter)},e));
  if(a==='listCodes') return requireAdmin_(e,()=>json_({ok:true,codes:rows_(SHEETS.accessCodes)},e));
  if(a==='state') return saveTeamState_(e);
  if(a==='event') return saveEvent_(e);
  if(a==='restore') return restoreTeamByCode_(e);
  if(a==='admin') return requireAdmin_(e,()=>json_(adminData_(),e));
  if(a==='adminStation') return requireAdmin_(e,()=>json_(adminStationData_(e),e));
  if(a==='add') return addLeaderboard_(e);
  return json_({rows:leaderboardRows_()},e);
}

function adminPassword_(){ return String(PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_PROPERTY) || ''); }
function requireAdmin_(e,fn){ if(!adminPassword_() || String(e.parameter.adminPassword||'')!==adminPassword_()) return json_({ok:false,error:'unauthorized'},e); return fn(); }
function normalize_(v){ return String(v||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,''); }
function parseJson_(v,f){ try{return JSON.parse(String(v||''));}catch(e){return f;} }
function mediaTypeFromName_(name){ const ext=String(name||'').split('.').pop().toLowerCase(); if(ext==='jpg'||ext==='jpeg') return 'image/jpeg'; if(ext==='png') return 'image/png'; if(ext==='webp') return 'image/webp'; return 'application/octet-stream'; }
function czDateTime_(){ return Utilities.formatDate(new Date(), 'Europe/Prague', 'dd.MM.yyyy HH:mm:ss'); }

function stationSecret_(id){ return rows_(SHEETS.secrets).find(r=>Number(r.stationId)===Number(id)); }
function secretImage_(name){ const target=String(name||'').trim(); if(!target) return null; return rows_(SHEETS.secretImages).find(r=>String(r.fileName||'').trim()===target) || null; }
function secretImageDataUrl_(name){
  const rec=secretImage_(name);
  const fileId=String(rec && rec.driveFileId || '').trim();
  if(!fileId) return '';
  try{
    const blob=DriveApp.getFileById(fileId).getBlob();
    const mime=String(rec.mimeType||'').trim() || blob.getContentType() || mediaTypeFromName_(name);
    return 'data:'+mime+';base64,'+Utilities.base64Encode(blob.getBytes());
  }catch(err){
    return '';
  }
}
function withSecretImages_(value){
  if(!value || typeof value!=='object') return value;
  if(Array.isArray(value)) return value.map(withSecretImages_);
  const out={};
  Object.keys(value).forEach(k=>out[k]=value[k]);
  if(out.image && !out.imageDataUrl){
    const dataUrl=secretImageDataUrl_(out.image);
    if(dataUrl) out.imageDataUrl=dataUrl;
  }
  return out;
}
function accessCodeRecord_(code){ const target=normalize_(code); return rows_(SHEETS.accessCodes).find(r=>normalize_(r.accessCode)===target) || null; }
function touchAccessCode_(code, values){ const sh=getSheet_(SHEETS.accessCodes,HEADERS.accessCodes); const vals=sh.getDataRange().getValues(); const headers=vals[0].map(String); const target=normalize_(code); for(let r=1;r<vals.length;r++){ if(normalize_(vals[r][0])===target){ Object.keys(values).forEach(k=>{ const c=headers.indexOf(k); if(c>=0) sh.getRange(r+1,c+1).setValue(values[k]); }); return; } } }

function validateAccessCode_(e){
  const code=normalize_(e.parameter.accessCode||e.parameter.code||'');
  const rec=accessCodeRecord_(code);
  if(!rec || String(rec.status||'').toLowerCase()!=='active') return json_({ok:false,error:'invalid_code'},e);
  touchAccessCode_(code,{lastUsedAt:new Date().toISOString()});
  return json_({ok:true,accessCode:code,customerName:String(rec.customerName||''),email:String(rec.email||''),orderType:String(rec.orderType||'')},e);
}
function checkStationCode_(e){
  const accessCode=normalize_(e.parameter.accessCode||'');
  if(!accessCodeRecord_(accessCode)) return json_({ok:false,error:'invalid_access_code'},e);
  const station=Number(e.parameter.station||e.parameter.stationId||0);
  const value=normalize_(e.parameter.value||e.parameter.code||'');
  const secret=stationSecret_(station);
  if(!secret) return json_({ok:false,error:'invalid_station'},e);
  const expected=normalize_(secret.unlockCode||'');
  return json_({ok:!!expected && value===expected,station},e);
}
function hint_(e){
  const accessCode=normalize_(e.parameter.accessCode||'');
  if(!accessCodeRecord_(accessCode)) return json_({ok:false,error:'invalid_access_code'},e);
  const station=Number(e.parameter.station||e.parameter.stationId||0), num=Math.max(1,Number(e.parameter.num||1));
  const secret=stationSecret_(station), hints=withSecretImages_(parseJson_(secret && secret.hintsJson,[]));
  if(!hints[num-1]) return json_({ok:false,error:'missing_hint'},e);
  return json_({ok:true,station,num,hint:hints[num-1],hintCount:hints.length},e);
}
function solution_(e){
  const accessCode=normalize_(e.parameter.accessCode||'');
  if(!accessCodeRecord_(accessCode)) return json_({ok:false,error:'invalid_access_code'},e);
  const station=Number(e.parameter.station||e.parameter.stationId||0), secret=stationSecret_(station);
  if(!secret) return json_({ok:false,error:'invalid_station'},e);
  return json_({ok:true,station,solution:withSecretImages_(parseJson_(secret.solutionJson,''))},e);
}
function adminStationData_(e){
  const station=Number(e.parameter.station||e.parameter.stationId||0), secret=stationSecret_(station);
  if(!secret) return {ok:false,error:'invalid_station'};
  return {
    ok:true,
    station,
    hints:withSecretImages_(parseJson_(secret.hintsJson,[])),
    solution:withSecretImages_(parseJson_(secret.solutionJson,''))
  };
}
function saveLead_(e){
  const sh=getSheet_(SHEETS.leads,HEADERS.leads); const payloadText=String(e.parameter.payload||'{}'); const p=parseJson_(payloadText,{});
  const type=String(e.parameter.type||'kontakt'); const name=String(p['Jméno a příjmení']||p['Jméno objednatele']||p['Kontaktní osoba']||p['Jméno']||p['Název firmy']||'');
  const email=String(p['E-mail']||''), phone=String(p['Telefon']||''); sh.appendRow([czDateTime_(),type,name,email,phone,payloadText,'new']);
  if(LEAD_NOTIFICATION_EMAIL && LEAD_NOTIFICATION_EMAIL.indexOf('@')>-1) MailApp.sendEmail({to:LEAD_NOTIFICATION_EMAIL,subject:'Hravá Plzeň - '+type,body:Object.keys(p).map(k=>k+': '+p[k]).join('\n')});
  return json_({ok:true},e);
}
function createAccessCodes_(p){
  const sh=getSheet_(SHEETS.accessCodes,HEADERS.accessCodes); const count=Math.max(1,Math.min(100,Number(p.count||1))); const existing=new Set(rows_(SHEETS.accessCodes).map(r=>normalize_(r.accessCode))); const out=[], batch=[], now=new Date().toISOString();
  while(out.length<count){ const code='GZ-'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase(); if(existing.has(normalize_(code))) continue; existing.add(normalize_(code)); out.push(code); batch.push([code,String(p.customerName||''),String(p.email||''),String(p.phone||''),String(p.orderType||''),String(p.status||'active'),now,String(p.customerName||p.email||p.phone||'')?now:'',String(p.notes||''),'','','','']); }
  sh.getRange(sh.getLastRow()+1,1,batch.length,HEADERS.accessCodes.length).setValues(batch); return out;
}
function saveTeamState_(e){
  const id=String(e.parameter.id||''); if(!id) return json_({ok:false,error:'missing id'},e); const sh=getSheet_(SHEETS.teams,HEADERS.teams); const accessCode=normalize_(e.parameter.accessCode||''); const row=findRowById_(sh,id);
  const values=[id,String(e.parameter.team||''),accessCode,Number(e.parameter.currentStation||1),String(e.parameter.stationTitle||''),String(e.parameter.startTime||''),String(e.parameter.updatedAt||new Date().toISOString()),String(e.parameter.finished||'0'),String(e.parameter.finishTime||''),String(e.parameter.hints||'{}'),String(e.parameter.solutions||'{}'),String(e.parameter.wrong||'{}'),Number(e.parameter.wrongTotal||0),String(e.parameter.completed||'[]'),String(e.parameter.lastPos||'')];
  if(row>0) sh.getRange(row,1,1,values.length).setValues([values]); else sh.appendRow(values); if(accessCode) touchAccessCode_(accessCode,{teamId:id,teamName:String(e.parameter.team||''),startedAt:String(e.parameter.startTime||''),lastUsedAt:new Date().toISOString()}); return json_({ok:true},e);
}
function saveEvent_(e){ const sh=getSheet_(SHEETS.events,HEADERS.events); const item={time:String(e.parameter.time||new Date().toISOString()),teamId:String(e.parameter.teamId||''),team:String(e.parameter.team||''),accessCode:normalize_(e.parameter.accessCode||''),type:String(e.parameter.type||''),eventName:String(e.parameter.eventName||''),station:Number(e.parameter.station||1),stationTitle:String(e.parameter.stationTitle||''),hint:String(e.parameter.hint||''),value:String(e.parameter.value||''),detail:String(e.parameter.detail||'{}')}; const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); sh.appendRow(headers.map(h=>item[h]!==undefined?item[h]:'')); return json_({ok:true},e); }
function addLeaderboard_(e){ const id=String(e.parameter.id||''); if(!id) return json_({ok:false,error:'missing id'},e); const sh=getSheet_(SHEETS.leaderboard,HEADERS.leaderboard); if(findRowById_(sh,id)<0) sh.appendRow([id,String(e.parameter.team||'Bez nazvu'),Number(e.parameter.total||0),Number(e.parameter.hints||0),Number(e.parameter.solutions||0),String(e.parameter.title||''),String(e.parameter.date||new Date().toISOString())]); return json_({ok:true},e); }
function restoreTeamByCode_(e){ const code=normalize_(e.parameter.accessCode||''); if(!accessCodeRecord_(code)) return json_({team:null},e); const rows=rows_(SHEETS.teams).filter(r=>normalize_(r.accessCode)===code).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))); return json_({team:rows[0]||null},e); }
function adminData_(){ return {ok:true,teams:rows_(SHEETS.teams).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))),events:rows_(SHEETS.events).slice(-200),leaderboard:leaderboardRows_(),accessCodes:rows_(SHEETS.accessCodes),leads:rows_(SHEETS.leads).slice(-100)}; }
function leaderboardRows_(){ return rows_(SHEETS.leaderboard).filter(r=>r.id).map(r=>({id:String(r.id),team:String(r.team||'Bez nazvu'),total:Number(r.total||0),hints:Number(r.hints||0),solutions:Number(r.solutions||0),title:String(r.title||''),date:String(r.date||'')})).sort((a,b)=>a.total-b.total).slice(0,50); }
function rows_(name){ const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); if(!sh||sh.getLastRow()<2) return []; const vals=sh.getDataRange().getValues(), headers=vals[0].map(String); return vals.slice(1).map(row=>{ const o={}; headers.forEach((h,i)=>o[h]=row[i]); return o; }); }
function getSheet_(name,headers){ const ss=SpreadsheetApp.getActiveSpreadsheet(); let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); if(sh.getLastRow()===0) sh.appendRow(headers); ensureHeaders_(sh,headers); return sh; }
function ensureHeaders_(sh,required){ const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String); const missing=required.filter(h=>current.indexOf(h)===-1); if(missing.length) sh.getRange(1,current.length+1,1,missing.length).setValues([missing]); }
function findRowById_(sh,id){ if(sh.getLastRow()<2) return -1; const vals=sh.getRange(2,1,sh.getLastRow()-1,1).getValues(); for(let i=0;i<vals.length;i++){ if(String(vals[i][0])===id) return i+2; } return -1; }
function json_(data,e){ const text=JSON.stringify(data), cb=e&&e.parameter&&e.parameter.callback; if(cb) return ContentService.createTextOutput(`${cb}(${text});`).setMimeType(ContentService.MimeType.JAVASCRIPT); return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON); }



