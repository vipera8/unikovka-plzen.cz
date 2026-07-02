const ADMIN_PASSWORD_PROPERTY = 'ADMIN_PASSWORD';
const LEAD_NOTIFICATION_EMAIL = 'info@unikovka-plzen.cz';
const PUBLIC_FROM_EMAIL = 'info@unikovka-plzen.cz';
const PUBLIC_EMAIL_NAME = 'Únikovka Plzeň';
const SPREADSHEET_ID = '16i2AtR6o3C6cMnXaDelDcynyQmpq7id1TtSc_bSj72E';
const GOOGLE_REVIEW_URL = 'https://g.page/r/CThaNwiGz76cEBM/review';
const FACEBOOK_REVIEW_URL = 'https://www.facebook.com/profile.php?id=61591459980333&sk=reviews';
const FINISHED_TEAM_ADMIN_VISIBLE_MS = 2 * 60 * 60 * 1000;
const SHEETS = {
  leaderboard: 'Leaderboard', teams: 'Teams', events: 'Events',
  accessCodes: 'AccessCodes', leads: 'Leads', vouchers: 'Vouchers', secrets: 'StationSecrets',
  secretImages: 'SecretImages'
};
const HEADERS = {
  accessCodes: ['accessCode','customerName','email','phone','orderType','variant','status','createdAt','assignedAt','notes','teamId','teamName','startedAt','lastUsedAt','reviewEmailSentAt'],
  leads: ['time','type','name','email','phone','payload','status','amountKc','confirmedEmailSentAt','paidEmailSentAt','voucherCode','voucherValidUntil','accessCode','accessCodeCreatedAt'],
  vouchers: ['voucherCode','status','buyerName','buyerEmail','phone','amountKc','variant','createdAt','paidAt','validUntil','leadRow','usedAt','notes'],
  secrets: ['stationId','title','unlockCode','hintsJson','solutionJson'],
  secretImages: ['fileName','driveFileId','mimeType','notes'],
  teams: ['id','team','accessCode','variant','currentStation','stationTitle','startTime','updatedAt','finished','finishTime','hints','solutions','wrong','wrongTotal','completed','lastPos','startTimeCz','updatedAtCz','finishTimeCz'],
  events: ['time','timeCz','teamId','team','accessCode','variant','type','eventName','station','stationTitle','hint','value','detail'],
  leaderboard: ['id','team','total','hints','solutions','title','date','dateCz','variant']
};

function onOpen(){ SpreadsheetApp.getUi().createMenu('Hravá Plzeň').addItem('Připravit tabulky','setupSheets').addItem('Nastavit rozbalovací status a ceny','setupLeadDropdowns').addItem('Vygenerovat voucherový kód','generateVoucherManual').addItem('Nainstalovat automatické e-maily','installLeadStatusTrigger').addItem('Vygenerovat 10 kódů - delší varianta','generateTenLongCodes').addItem('Vygenerovat 10 kódů - krátká varianta','generateTenShortCodes').addToUi(); }
function setupSheets(){ Object.keys(SHEETS).forEach(k=>getSheet_(SHEETS[k], HEADERS[k])); setupLeadDropdowns_(); }
const LEAD_STATUS_OPTIONS = ['nové','čeká na platbu','potvrzeno','zaplaceno','čeká na odpověď','zrušeno','vyřízeno'];
const LEAD_AMOUNT_OPTIONS = ['1200','1500','1600','1900'];
function setupLeadStatusValidation(){ setupLeadDropdowns_(); }
function setupLeadDropdowns(){ setupLeadDropdowns_(); }
function setupLeadDropdowns_(){
  const sh=getSheet_(SHEETS.leads, HEADERS.leads);
  arrangeLeadAmountColumn_(sh);
  const headers=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);
  const rows=Math.max(sh.getMaxRows()-1,999);
  if(sh.getMaxRows()<rows+1) sh.insertRowsAfter(sh.getMaxRows(), rows+1-sh.getMaxRows());
  setLeadDropdown_(sh,headers,'status',LEAD_STATUS_OPTIONS,rows);
  setLeadDropdown_(sh,headers,'amountKc',LEAD_AMOUNT_OPTIONS,rows);
}
function arrangeLeadAmountColumn_(sh){
  const headers=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);
  const statusCol=headers.indexOf('status')+1;
  const amountCol=headers.indexOf('amountKc')+1;
  if(statusCol>0 && amountCol>0 && amountCol!==statusCol+1) sh.moveColumns(sh.getRange(1,amountCol,sh.getMaxRows(),1), statusCol+1);
}
function setLeadDropdown_(sh,headers,columnName,options,rows){
  const col=headers.indexOf(columnName)+1;
  if(col<1) return;
  const range=sh.getRange(2,col,rows,1);
  range.clearDataValidations();
  const rule=SpreadsheetApp.newDataValidation().requireValueInList(options,true).setAllowInvalid(false).build();
  range.setDataValidation(rule);
  SpreadsheetApp.flush();
}
function generateTenFreeCodes(){ generateTenLongCodes(); }
function generateTenLongCodes(){ setupSheets(); const codes=createAccessCodes_({count:10,status:'active',orderType:'delší varianta',variant:'long'}); SpreadsheetApp.getUi().alert('Vygenerované kódy pro delší variantu:\n'+codes.join('\n')); }
function generateTenShortCodes(){ setupSheets(); const codes=createAccessCodes_({count:10,status:'active',orderType:'krátká varianta',variant:'short'}); SpreadsheetApp.getUi().alert('Vygenerované kódy pro krátkou variantu:\n'+codes.join('\n')); }
function generateVoucherManual(){ setupSheets(); const code=createVoucherCode_(); const sh=getSheet_(SHEETS.vouchers, HEADERS.vouchers); sh.appendRow([code,'vytvořen','','','','','',czDateTime_(),'','','','','']); SpreadsheetApp.getUi().alert('Vygenerovaný voucherový kód:\n'+code); }
function createVoucherCode_(){
  const sh=getSheet_(SHEETS.vouchers, HEADERS.vouchers);
  const existing=sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String) : [];
  let code;
  do { code='HP-V-'+Utilities.getUuid().replace(/-/g,'').slice(0,6).toUpperCase(); } while(existing.indexOf(code)>=0);
  return code;
}
function ensureVoucherForLead_(item,p,row){
  const sh=getSheet_(SHEETS.vouchers, HEADERS.vouchers);
  const values=sh.getLastRow()>1 ? sh.getDataRange().getValues() : [HEADERS.vouchers];
  const headers=values[0].map(String);
  const leadCol=headers.indexOf('leadRow');
  const validCol=headers.indexOf('validUntil');
  if(leadCol>=0){
    for(let i=1;i<values.length;i++){
      if(String(values[i][leadCol])===String(row)) return {code:String(values[i][0]||''), validUntil:validCol>=0 ? String(values[i][validCol]||'') : ''};
    }
  }
  const code=createVoucherCode_();
  const paidAt=czDateTime_();
  const validUntil=voucherValidUntil_();
  const buyerName=String(item.name||p['Jméno objednatele']||p['Jméno a příjmení']||p['Jméno']||'');
  const buyerEmail=String(item.email||'');
  const phone=String(item.phone||p['Telefon']||'');
  const amount=String(item.amountKc||inferLeadAmountKc_('poukaz',p)||'');
  const variant=String(p['Varianta hry']||p['Varianta']||p['Typ poukazu']||'');
  sh.appendRow([code,'zaplaceno',buyerName,buyerEmail,phone,amount,variant,paidAt,paidAt,validUntil,row,'','']);
  return {code, validUntil};
}
function voucherValidUntil_(){ const d=new Date(); d.setFullYear(d.getFullYear()+1); return Utilities.formatDate(d, 'Europe/Prague', 'dd.MM.yyyy'); }
function ensureReservationAccessCode_(item,p,row){
  if(String(item.accessCode||'').trim()) return String(item.accessCode).trim();
  const variant=leadVariant_(p,item);
  const name=String(item.name||p['Jméno a příjmení']||p['Jméno objednatele']||p['Jméno']||'');
  const email=String(item.email||p['E-mail']||'');
  const phone=String(item.phone||p['Telefon']||'');
  const codes=createAccessCodes_({
    count:1,
    status:'active',
    orderType:variantLabel_(variant),
    variant,
    customerName:name,
    email,
    phone,
    notes:'Rezervace z Leads, řádek '+row
  });
  return codes[0] || '';
}
function leadVariant_(p,item){
  const text=String(p['Varianta hry']||p['Varianta']||p['Typ poukazu']||item?.variant||item?.orderType||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return text.indexOf('krat')>=0 || text.indexOf('short')>=0 ? 'short' : 'long';
}
function installLeadStatusTrigger(){ ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='leadStatusOnEdit_').forEach(t=>t && ScriptApp.deleteTrigger(t)); ScriptApp.newTrigger('leadStatusOnEdit_').forSpreadsheet(workbook_()).onEdit().create(); }

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
  return json_({rows:leaderboardRows_(e.parameter.variant)},e);
}

function adminPassword_(){ return String(PropertiesService.getScriptProperties().getProperty(ADMIN_PASSWORD_PROPERTY) || ''); }
function requireAdmin_(e,fn){ if(!adminPassword_() || String(e.parameter.adminPassword||'')!==adminPassword_()) return json_({ok:false,error:'unauthorized'},e); return fn(); }
function normalize_(v){ return String(v||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,''); }
function parseJson_(v,f){ try{return JSON.parse(String(v||''));}catch(e){return f;} }
function mediaTypeFromName_(name){ const ext=String(name||'').split('.').pop().toLowerCase(); if(ext==='jpg'||ext==='jpeg') return 'image/jpeg'; if(ext==='png') return 'image/png'; if(ext==='webp') return 'image/webp'; return 'application/octet-stream'; }
function czDateTime_(){ return Utilities.formatDate(new Date(), 'Europe/Prague', 'dd.MM.yyyy HH:mm:ss'); }
function formatDateTimeCz_(value){
  if(!value) return '';
  const n=Number(value);
  const d=isNaN(n) ? new Date(String(value)) : new Date(n);
  if(isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'Europe/Prague', 'dd.MM.yyyy HH:mm:ss');
}

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
  Object.keys(value).forEach(k=>out[k]=withSecretImages_(value[k]));
  if(out.image && !out.imageDataUrl){
    const dataUrl=secretImageDataUrl_(out.image);
    if(dataUrl) out.imageDataUrl=dataUrl;
  }
  return out;
}
function accessCodeRecord_(code){ const target=normalize_(code); return rows_(SHEETS.accessCodes).find(r=>normalize_(r.accessCode)===target) || null; }
function variantFromCode_(code, orderType){ const c=normalize_(code).replace(/[^A-Z0-9]/g,''); const order=String(orderType||'').toLowerCase(); if(c.indexOf('GZK')===0 || order.indexOf('krat')>=0 || order.indexOf('krát')>=0 || order.indexOf('short')>=0) return 'short'; return 'long'; }
function variantFromParam_(p){ const v=String(p.variant||p.gameVariant||'').toLowerCase(); if(v==='short' || v==='kratka' || v==='krátká') return 'short'; if(v==='long' || v==='delsi' || v==='delší') return 'long'; return variantFromCode_(p.accessCode||p.code||'', p.orderType||''); }
function variantPrefix_(variant){ return variant==='short' ? 'K' : 'D'; }
function variantLabel_(variant){ return variant==='short' ? 'krátká varianta' : 'delší varianta'; }
function touchAccessCode_(code, values){ const sh=getSheet_(SHEETS.accessCodes,HEADERS.accessCodes); const vals=sh.getDataRange().getValues(); const headers=vals[0].map(String); const target=normalize_(code); for(let r=1;r<vals.length;r++){ if(normalize_(vals[r][0])===target){ Object.keys(values).forEach(k=>{ const c=headers.indexOf(k); if(c>=0) sh.getRange(r+1,c+1).setValue(values[k]); }); return; } } }

function validateAccessCode_(e){
  const code=normalize_(e.parameter.accessCode||e.parameter.code||'');
  const rec=accessCodeRecord_(code);
  if(!rec || String(rec.status||'').toLowerCase()!=='active') return json_({ok:false,error:'invalid_code'},e);
  const variant=String(rec.variant||'') || variantFromCode_(code, rec.orderType||'');
  touchAccessCode_(code,{lastUsedAt:new Date().toISOString(),variant});
  return json_({ok:true,accessCode:code,variant,customerName:String(rec.customerName||''),email:String(rec.email||''),orderType:String(rec.orderType||'')},e);
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
  const sh=getSheet_(SHEETS.leads,HEADERS.leads); const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const payloadText=String(e.parameter.payload||'{}'); const p=parseJson_(payloadText,{});
  const type=String(e.parameter.type||'kontakt'); const name=String(p['Jméno a příjmení']||p['Jméno objednatele']||p['Kontaktní osoba']||p['Jméno']||p['Název firmy']||'');
  const email=String(p['E-mail']||''), phone=String(p['Telefon']||'');
  const amountKc=inferLeadAmountKc_(type,p);
  const initialStatus=type==='poukaz' ? 'čeká na platbu' : 'nové';
  const item={time:czDateTime_(),type,name,email,phone,payload:payloadText,status:initialStatus,amountKc,confirmedEmailSentAt:type==='poukaz'?new Date().toISOString():'',paidEmailSentAt:'',voucherCode:'',voucherValidUntil:''}; sh.appendRow(headers.map(h=>item[h]!==undefined?item[h]:''));
  if(LEAD_NOTIFICATION_EMAIL && LEAD_NOTIFICATION_EMAIL.indexOf('@')>-1) sendPublicEmail_({to:LEAD_NOTIFICATION_EMAIL,subject:'Únikovka Plzeň - '+type,body:leadInternalNotificationBody_(type,p,item)});
  if(email && email.indexOf('@')>-1) sendPublicEmail_({to:email,subject:leadCustomerSubject_(type),body:leadCustomerBody_(type,name,p,item)});
  return json_({ok:true},e);
}
function leadCustomerSubject_(type){
  if(type==='rezervace') return 'Grollova zlatá stopa - přijali jsme vaši rezervaci';
  if(type==='poukaz') return 'Dárkový poukaz Grollova zlatá stopa - platební údaje';
  if(type==='firma') return 'Grollova zlatá stopa - přijali jsme firemní poptávku';
  return 'Únikovka Plzeň - přijali jsme vaši zprávu';
}
function leadCustomerBody_(type,name,p,item){
  const hello=name ? 'Dobrý den, '+name+',' : 'Dobrý den,';
  const footer='\n\nÚnikovka Plzeň\nGrollova zlatá stopa\nE-mail: info@unikovka-plzen.cz\nTelefon: 737 256 827\n\nToto je automatické potvrzení přijetí formuláře.';
  if(type==='rezervace'){
    return hello+'\n\nDěkujeme za rezervaci hry Grollova zlatá stopa.\n\nVaši poptávku jsme přijali. Nejdříve ověříme požadovaný termín a poté vám pošleme potvrzení s platebními údaji a dalšími informacemi ke startu hry.\n\nShrnutí rezervace:\n'+leadPayloadLines_(p)+footer;
  }
  if(type==='poukaz'){
    return voucherPaymentBody_(name,p,item);
  }
  if(type==='firma'){
    return hello+'\n\nDěkujeme za firemní poptávku ke hře Grollova zlatá stopa.\n\nPoptávku jsme přijali a ozveme se vám s návrhem dalšího postupu a vhodného termínu.\n\nShrnutí poptávky:\n'+leadPayloadLines_(p)+footer;
  }
  return hello+'\n\nDěkujeme za zprávu. Přijali jsme ji a brzy se vám ozveme.\n\nShrnutí zprávy:\n'+leadPayloadLines_(p)+footer;
}
function leadPayloadLines_(p){
  return Object.keys(p).filter(k=>String(p[k]||'').trim()).map(k=>'- '+k+': '+p[k]).join('\n');
}
function leadInternalNotificationBody_(type,p,item){
  const lines=['Nová zpráva z webu Únikovka Plzeň','', 'Typ: '+type, 'Stav: '+String(item.status||''), 'Částka: '+(amountLabel_(item.amountKc)||'nevyplněno'), ''];
  const details=Object.keys(p).filter(k=>String(p[k]||'').trim()).map(k=>k+': '+p[k]).join('\n');
  return lines.join('\n')+details;
}
function inferLeadAmountKc_(type,p){
  if(type!=='poukaz') return '';
  const variantText=String(p['Varianta hry']||p['Varianta']||p['Typ poukazu']||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const playersText=String(p['Počet hráčů']||p['Pocet hracu']||p['Počet osob']||'');
  const match=playersText.match(/\d+/);
  const players=match ? Number(match[0]) : 0;
  if(!players) return '';
  const isShort=variantText.indexOf('krat')>=0;
  const isLong=variantText.indexOf('dels')>=0 || variantText.indexOf('del')>=0 || !isShort;
  if(isShort) return players===2 ? '1200' : '1600';
  if(isLong) return players===2 ? '1500' : '1900';
  return '';
}
function voucherPaymentBody_(name,p,item){
  const hello=name ? 'Dobrý den, '+name+',' : 'Dobrý den,';
  const amount=amountLabel_(item && item.amountKc);
  const paymentLines=amount ? ['Částka k úhradě:',amount,''] : ['Částku k úhradě vám ještě potvrdíme podle zvolené varianty a počtu hráčů.',''];
  return [hello,'','děkujeme za objednávku dárkového poukazu na hru Grollova zlatá stopa.','', 'Shrnutí objednávky:', leadPayloadLines_(p),''].concat(paymentLines).concat(['Platbu prosím zašlete na účet:','1025666081/5500','','Do zprávy pro příjemce uveďte:',leadPaymentIdentifier_(name,p,item),'','Po přijetí platby vystavíme elektronický poukaz s unikátním číslem voucheru. Platnost poukazu je 12 měsíců od zaplacení.','','Děkujeme.','','Únikovka Plzeň','Grollova zlatá stopa','info@unikovka-plzen.cz','737 256 827']).join('\n');
}
function leadPaymentIdentifier_(name,p,item){
  const who=String(name||p['Jméno objednatele']||p['Jméno a příjmení']||item?.name||item?.email||'objednávka').trim();
  return 'Dárkový poukaz - '+who;
}
function createAccessCodes_(p){
  const sh=getSheet_(SHEETS.accessCodes,HEADERS.accessCodes); const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const count=Math.max(1,Math.min(100,Number(p.count||1))); const existing=new Set(rows_(SHEETS.accessCodes).map(r=>normalize_(r.accessCode))); const out=[], batch=[], now=new Date().toISOString(); const variant=variantFromParam_(p); const prefix=variantPrefix_(variant);
  while(out.length<count){ const code='GZ-'+prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase(); if(existing.has(normalize_(code))) continue; existing.add(normalize_(code)); out.push(code); const item={accessCode:code,customerName:String(p.customerName||''),email:String(p.email||''),phone:String(p.phone||''),orderType:String(p.orderType||variantLabel_(variant)),variant,status:String(p.status||'active'),createdAt:now,assignedAt:String(p.customerName||p.email||p.phone||'')?now:'',notes:String(p.notes||''),teamId:'',teamName:'',startedAt:'',lastUsedAt:'',reviewEmailSentAt:''}; batch.push(headers.map(h=>item[h]!==undefined?item[h]:'')); }
  sh.getRange(sh.getLastRow()+1,1,batch.length,headers.length).setValues(batch); return out;
}
function saveTeamState_(e){
  const id=String(e.parameter.id||''); if(!id) return json_({ok:false,error:'missing id'},e); const sh=getSheet_(SHEETS.teams,HEADERS.teams); const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const accessCode=normalize_(e.parameter.accessCode||''); const row=findRowById_(sh,id);
  const startTime=String(e.parameter.startTime||''), updatedAt=String(e.parameter.updatedAt||new Date().toISOString()), finishTime=String(e.parameter.finishTime||''); const variant=variantFromParam_(e.parameter);
  const item={id,team:String(e.parameter.team||''),accessCode,variant,currentStation:Number(e.parameter.currentStation||1),stationTitle:String(e.parameter.stationTitle||''),startTime,updatedAt,finished:String(e.parameter.finished||'0'),finishTime,hints:String(e.parameter.hints||'{}'),solutions:String(e.parameter.solutions||'{}'),wrong:String(e.parameter.wrong||'{}'),wrongTotal:Number(e.parameter.wrongTotal||0),completed:String(e.parameter.completed||'[]'),lastPos:String(e.parameter.lastPos||''),startTimeCz:formatDateTimeCz_(startTime),updatedAtCz:formatDateTimeCz_(updatedAt),finishTimeCz:formatDateTimeCz_(finishTime)};
  const values=headers.map(h=>item[h]!==undefined?item[h]:'');
  if(row>0) sh.getRange(row,1,1,values.length).setValues([values]); else sh.appendRow(values);
  if(accessCode) touchAccessCode_(accessCode,{teamId:id,teamName:String(e.parameter.team||''),startedAt:String(e.parameter.startTime||''),lastUsedAt:new Date().toISOString(),variant});
  if(String(e.parameter.finished||'0')==='1' && finishTime) sendReviewEmailIfNeeded_(accessCode, String(e.parameter.team||''), variant);
  return json_({ok:true},e);
}
function saveEvent_(e){ const sh=getSheet_(SHEETS.events,HEADERS.events); const time=String(e.parameter.time||new Date().toISOString()); const item={time,timeCz:formatDateTimeCz_(time),teamId:String(e.parameter.teamId||''),team:String(e.parameter.team||''),accessCode:normalize_(e.parameter.accessCode||''),variant:variantFromParam_(e.parameter),type:String(e.parameter.type||''),eventName:String(e.parameter.eventName||''),station:Number(e.parameter.station||1),stationTitle:String(e.parameter.stationTitle||''),hint:String(e.parameter.hint||''),value:String(e.parameter.value||''),detail:String(e.parameter.detail||'{}')}; const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); sh.appendRow(headers.map(h=>item[h]!==undefined?item[h]:'')); return json_({ok:true},e); }
function addLeaderboard_(e){ const id=String(e.parameter.id||''); if(!id) return json_({ok:false,error:'missing id'},e); const sh=getSheet_(SHEETS.leaderboard,HEADERS.leaderboard); const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const date=String(e.parameter.date||new Date().toISOString()); if(findRowById_(sh,id)<0){ const item={id,team:String(e.parameter.team||'Bez nazvu'),total:Number(e.parameter.total||0),hints:Number(e.parameter.hints||0),solutions:Number(e.parameter.solutions||0),title:String(e.parameter.title||''),date,dateCz:formatDateTimeCz_(date),variant:variantFromParam_(e.parameter)}; sh.appendRow(headers.map(h=>item[h]!==undefined?item[h]:'')); } return json_({ok:true},e); }
function restoreTeamByCode_(e){ const code=normalize_(e.parameter.accessCode||''); if(!accessCodeRecord_(code)) return json_({team:null},e); const rows=rows_(SHEETS.teams).filter(r=>normalize_(r.accessCode)===code).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))); return json_({team:rows[0]||null},e); }
function adminData_(){ const allTeams=rows_(SHEETS.teams).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))); const teams=adminVisibleTeams_(allTeams); const visibleIds={}; teams.forEach(t=>visibleIds[String(t.id||'')]=true); const events=rows_(SHEETS.events).filter(e=>!e.teamId || visibleIds[String(e.teamId||'')]).slice(-200); return {ok:true,teams,events,leaderboard:leaderboardRows_(),accessCodes:rows_(SHEETS.accessCodes),leads:rows_(SHEETS.leads).slice(-100)}; }
function adminVisibleTeams_(teams){ const cutoff=Date.now()-FINISHED_TEAM_ADMIN_VISIBLE_MS; return teams.filter(t=>{ const finished=String(t.finished||'0')==='1' || t.finished===true; if(!finished) return true; const finish=Number(t.finishTime||0); return !finish || finish>=cutoff; }); }
function leaderboardRows_(wantedVariant){ const wanted=String(wantedVariant||'').toLowerCase(); return rows_(SHEETS.leaderboard).filter(r=>r.id).map(r=>({id:String(r.id),team:String(r.team||'Bez nazvu'),total:Number(r.total||0),hints:Number(r.hints||0),solutions:Number(r.solutions||0),title:String(r.title||''),date:String(r.date||''),dateCz:String(r.dateCz||''),variant:String(r.variant||'long')})).filter(r=>!wanted || r.variant===wanted).sort((a,b)=>a.total-b.total).slice(0,50); }
function sendReviewEmailIfNeeded_(accessCode, teamName, variant){
  if(!accessCode) return;
  const rec=accessCodeRecord_(accessCode);
  if(!rec || String(rec.reviewEmailSentAt||'').trim()) return;
  const email=String(rec.email||'').trim();
  if(email.indexOf('@')<0) return;
  const team=teamName || String(rec.teamName||'');
  try{
    sendPublicEmail_({to:email,subject:'Děkujeme za hru Grollova zlatá stopa',body:reviewEmailBody_(team, variant)});
    touchAccessCode_(accessCode,{reviewEmailSentAt:new Date().toISOString()});
  }catch(err){}
}
function reviewEmailBody_(teamName, variant){
  const teamLine=teamName ? 'Týme '+teamName+',' : 'Dobrý den,';
  const variantText=variant==='short' ? 'krátkou variantu' : 'delší variantu';
  return [
    teamLine,
    '',
    'děkujeme, že jste si zahráli Grollovu zlatou stopu. Věříme, že jste si '+variantText+' užili a odnesli si z Plzně pěkný zážitek.',
    '',
    'Pokud se vám hra líbila, moc nám pomůže krátká veřejná recenze. První hodnocení jsou pro novou hru obrovsky důležitá a pomůžou dalším týmům rozhodnout se, jestli se po Grollově stopě vydají také.',
    '',
    'Recenze na Googlu:',
    GOOGLE_REVIEW_URL,
    '',
    'Recenze na Facebooku:',
    FACEBOOK_REVIEW_URL,
    '',
    'Pokud nám chcete napsat připomínku, nápad na vylepšení nebo se během hry něco nepovedlo, napište nám prosím přímo na info@unikovka-plzen.cz. Každou zpětnou vazbu čteme a pomáhá nám hru dál ladit.',
    '',
    'Děkujeme a budeme se těšit třeba u další hry.',
    '',
    'Hravá Plzeň',
    'Grollova zlatá stopa',
    'info@unikovka-plzen.cz',
    '737 256 827'
  ].join('\n');
}
function leadStatusOnEdit_(e){
  try{
    const range=e && e.range;
    if(!range) return;
    const sh=range.getSheet();
    if(sh.getName()!==SHEETS.leads || range.getRow()<2) return;
    const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
    const statusCol=headers.indexOf('status')+1;
    if(range.getColumn()!==statusCol) return;
    handleLeadStatusRow_(sh, range.getRow(), headers);
  }catch(err){}
}
function handleLeadStatusRow_(sh, row, headers){
  const values=sh.getRange(row,1,1,headers.length).getValues()[0];
  const item={}; headers.forEach((h,i)=>item[h]=values[i]);
  const status=normalizeLeadStatus_(item.status);
  const email=String(item.email||'').trim();
  if(email.indexOf('@')<0) return;
  const p=parseJson_(item.payload,{});
  const name=String(item.name||p['Jméno a příjmení']||p['Jméno objednatele']||p['Kontaktní osoba']||p['Jméno']||'');
  if(status==='confirmed' && !String(item.confirmedEmailSentAt||'').trim()){
    sendPublicEmail_({to:email,subject:confirmedSubject_(item.type),body:confirmedBody_(item.type,name,p,item)});
    setLeadCell_(sh,row,headers,'confirmedEmailSentAt',new Date().toISOString());
  }
  if(status==='paid' && !String(item.paidEmailSentAt||'').trim()){
    const voucher=item.type==='poukaz' ? ensureVoucherForLead_(item,p,row) : {code:'',validUntil:''};
    const accessCode=item.type==='rezervace' ? ensureReservationAccessCode_(item,p,row) : '';
    if(item.type==='poukaz'){
      setLeadCell_(sh,row,headers,'voucherCode',voucher.code);
      setLeadCell_(sh,row,headers,'voucherValidUntil',voucher.validUntil);
    }
    if(item.type==='rezervace'){
      setLeadCell_(sh,row,headers,'accessCode',accessCode);
      setLeadCell_(sh,row,headers,'accessCodeCreatedAt',new Date().toISOString());
    }
    sendPublicEmail_({to:email,subject:paidSubject_(item.type),body:paidBody_(item.type,name,p,item,voucher.code,accessCode)});
    setLeadCell_(sh,row,headers,'paidEmailSentAt',new Date().toISOString());
  }
}
function normalizeLeadStatus_(status){
  const s=String(status||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  if(['potvrzeno','termin potvrzen','termín potvrzen','potvrzeny termin','potvrzený termín','confirmed'].indexOf(s)>=0) return 'confirmed';
  if(['ceka na platbu','čeká na platbu','waiting payment','awaiting payment'].indexOf(s)>=0) return 'waiting_payment';
  if(['zaplaceno','platba prijata','platba přijata','paid'].indexOf(s)>=0) return 'paid';
  return s;
}
function setLeadCell_(sh,row,headers,name,value){ const col=headers.indexOf(name)+1; if(col>0) sh.getRange(row,col).setValue(value); }
function confirmedSubject_(type){ if(type==='poukaz') return 'Dárkový poukaz Grollova zlatá stopa - platební údaje'; if(type==='firma') return 'Grollova zlatá stopa - potvrzení poptávky'; return 'Potvrzení rezervace hry Grollova zlatá stopa'; }
function confirmedBody_(type,name,p,item){
  const hello=name ? 'Dobrý den, '+name+',' : 'Dobrý den,';
  const payment=paymentLines_(item);
  if(type==='poukaz') return [hello,'','děkujeme za objednávku dárkového poukazu na hru Grollova zlatá stopa.','',summaryLines_(p),'',payment,'Platbu prosím zašlete na účet:','1025666081/5500','','Do zprávy pro příjemce uveďte:',leadPaymentIdentifier_(name,p,item),'','Po přijetí platby vám zašleme elektronický dárkový poukaz.','','Platnost poukazu je 12 měsíců od zaplacení.','','Děkujeme.','','Únikovka Plzeň','Grollova zlatá stopa','info@unikovka-plzen.cz','737 256 827'].flat().filter(v=>v!==null).join('\n');
  return [hello,'','potvrzujeme rezervaci hry Grollova zlatá stopa.','',summaryLines_(p),'',payment,'Platbu prosím zašlete na účet:','1025666081/5500','','Do zprávy pro příjemce uveďte:','Grollova stopa - '+(name || 'rezervace'),'','Po přijetí platby vám pošleme organizační informace ke hře. Přístupový kód do hry neposíláme předem, aby se hra nespouštěla mimo start. Dostanete ho při převzetí herního batohu.','','Děkujeme a těšíme se na vás.','','Únikovka Plzeň','Grollova zlatá stopa','info@unikovka-plzen.cz','737 256 827'].flat().filter(v=>v!==null).join('\n');
}
function paidSubject_(type){ if(type==='poukaz') return 'Dárkový poukaz Grollova zlatá stopa - platba přijata'; return 'Platba přijata - Grollova zlatá stopa'; }
function paidBody_(type,name,p,item,voucherCode,accessCode){
  const hello=name ? 'Dobrý den, '+name+',' : 'Dobrý den,';
  if(type==='poukaz') return [hello,'','děkujeme, platbu za dárkový poukaz jsme přijali.','','Poukaz připravíme a pošleme vám samostatně.','','Obdarovaný si termín hry vybere později přes web nebo e-mailem na info@unikovka-plzen.cz.','','Děkujeme.','','Únikovka Plzeň','Grollova zlatá stopa','info@unikovka-plzen.cz','737 256 827'].join('\n');
  return [hello,'','děkujeme, platbu jsme přijali.','','Vaše rezervace hry Grollova zlatá stopa je potvrzená.','','Místo startu:','Hlavní vlakové nádraží Plzeň, hlavní hala, u sochy Železničáře.','','Doporučujeme mít nabitý telefon, mobilní data a ideálně powerbanku. Hra běží jako webová aplikace, není potřeba nic instalovat.','','Vezměte si prosím také papír a tužku na případné poznámky během luštění.','','Přístupový kód do hry bude připravený u herního batohu a dostanete ho až na startu.','','Těšíme se na vás a přejeme skvělou hru.','','Únikovka Plzeň','Grollova zlatá stopa','info@unikovka-plzen.cz','737 256 827'].join('\n');
}
function paymentLines_(item){ const label=amountLabel_(item && item.amountKc); return label ? ['Částka k úhradě:',label,''] : []; }
function amountLabel_(value){ const raw=String(value||'').replace(/\s/g,'').replace(/Kč/gi,''); const n=Number(raw); if(!n) return ''; return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' Kč'; }
function summaryLines_(p){ return Object.keys(p).filter(k=>String(p[k]||'').trim()).map(k=>k+': '+p[k]).join('\n'); }
function rows_(name){ const sh=workbook_().getSheetByName(name); if(!sh||sh.getLastRow()<2) return []; const vals=sh.getDataRange().getValues(), headers=vals[0].map(String); return vals.slice(1).map(row=>{ const o={}; headers.forEach((h,i)=>o[h]=row[i]); return o; }); }
function workbook_(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }
function getSheet_(name,headers){ const ss=workbook_(); let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); if(sh.getLastRow()===0) sh.appendRow(headers); ensureHeaders_(sh,headers); return sh; }
function ensureHeaders_(sh,required){ const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String); const missing=required.filter(h=>current.indexOf(h)===-1); if(missing.length) sh.getRange(1,current.length+1,1,missing.length).setValues([missing]); }
function findRowById_(sh,id){ if(sh.getLastRow()<2) return -1; const vals=sh.getRange(2,1,sh.getLastRow()-1,1).getValues(); for(let i=0;i<vals.length;i++){ if(String(vals[i][0])===id) return i+2; } return -1; }
function sendPublicEmail_(message){
  const options=Object.assign({}, message);
  delete options.to;
  delete options.subject;
  delete options.body;
  options.name=PUBLIC_EMAIL_NAME;
  options.replyTo=PUBLIC_FROM_EMAIL;
  try{
    if(GmailApp.getAliases().indexOf(PUBLIC_FROM_EMAIL)!==-1) options.from=PUBLIC_FROM_EMAIL;
  }catch(err){}
  GmailApp.sendEmail(message.to, message.subject, message.body || '', options);
}

function json_(data,e){ const text=JSON.stringify(data), cb=e&&e.parameter&&e.parameter.callback; if(cb) return ContentService.createTextOutput(`${cb}(${text});`).setMimeType(ContentService.MimeType.JAVASCRIPT); return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON); }




function authorizeGmailAlias_(){
  GmailApp.getAliases();
}

function authorizeGmailAlias(){
  GmailApp.getAliases();
}
