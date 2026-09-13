const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
function setup({playError=false,frames=true,deferred=false}={}){
 const classes=new Set();
 const stage={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}};
 const video={isConnected:true,paused:true,readyState:frames?2:1,videoWidth:frames?640:0,videoHeight:frames?480:0,style:{},setAttribute(){},pause(){this.paused=true;},play(){if(playError)return Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));this.paused=false;return Promise.resolve();}};
 const start={style:{},disabled:false},status={textContent:''};
 let stopped=0,calls=0,release;
 const stream={getTracks:()=>[{stop(){stopped++;}}]};
 const elements={'#selfieVideo':video,'#selfieStage':stage,'#selfieStartBtn':start,'#selfieStatus':status};
 const context=vm.createContext({$:id=>elements[id],navigator:{mediaDevices:{getUserMedia(){calls++;return deferred?new Promise(r=>release=()=>r(stream)):Promise.resolve(stream);}}},setInterval,clearInterval,setTimeout:(fn,ms)=>setTimeout(fn,ms===10000?300:ms),clearTimeout});
 vm.runInContext('let selfieStream=null; let selfieCameraRequest=0; let selfieCameraStarting=false;'+source.slice(source.indexOf('function stopSelfieCamera(){'),source.indexOf('function openSelfieBooth(){'))+source.slice(source.indexOf('function waitForSelfiePreview('),source.indexOf('function selfieVintageFilter()')),context);
 return {context,video,stage,start,status,classes,get stopped(){return stopped;},get calls(){return calls;},release:()=>release()};
}
test('camera becomes ready only with playing frames',async()=>{const h=setup();await h.context.startSelfieCamera();assert(h.classes.has('camera-ready'));assert.equal(h.start.style.display,'none');h.context.stopSelfieCamera();assert.equal(h.stopped,1);});
test('blocked playback keeps retry visible and releases camera',async()=>{const h=setup({playError:true});await h.context.startSelfieCamera();assert(!h.classes.has('camera-ready'));assert.equal(h.start.disabled,false);assert.equal(h.start.style.display,'inline-flex');assert.equal(h.stopped,1);});
test('metadata without frames times out without false success',async()=>{const h=setup({frames:false});await h.context.startSelfieCamera();assert(!h.classes.has('camera-ready'));assert.equal(h.start.disabled,false);assert.equal(h.stopped,1);});
test('closing while permission is pending releases late stream',async()=>{const h=setup({deferred:true});const pending=h.context.startSelfieCamera();h.context.stopSelfieCamera();h.video.isConnected=false;h.release();await pending;assert.equal(h.stopped,1);assert(!h.classes.has('camera-ready'));});
test('double start requests only one stream',async()=>{const h=setup({deferred:true});const pending=h.context.startSelfieCamera();await h.context.startSelfieCamera();assert.equal(h.calls,1);h.release();await pending;h.context.stopSelfieCamera();});
