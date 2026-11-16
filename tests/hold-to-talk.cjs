const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function env(permission){
 let stopped=0,requested=0,recognizer;permission ||= ()=>Promise.resolve({getTracks:()=>[{stop(){stopped++}}]});class Recognition{constructor(){recognizer=this}start(){this.started=true;this.onstart?.()}stop(){this.onend?.()}abort(){this.aborted=true}}
 const listeners={},button={disabled:false,textContent:'',setAttribute(){},classList:{toggle(){}},addEventListener(n,f){listeners[n]=f},removeEventListener(){},setPointerCapture(){}};
 const input={value:'原草稿',readOnly:false},label={textContent:''};let status='';const doc={hidden:false,addEventListener(){},removeEventListener(){}};
 const window={isSecureContext:true,SpeechRecognition:Recognition,addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/frontend/hold-to-talk.js'),'utf8'),{window,document:doc,navigator:{mediaDevices:{getUserMedia(){requested++;return permission()}}},setTimeout,clearTimeout});
 const controller=window.AdeHoldToTalk.mount({button,input,label,status:t=>status=t});
 return {controller,button,input,label,listeners,get requested(){return requested},get stopped(){return stopped},get rec(){return recognizer},get status(){return status}};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('press opens actual microphone, release commits draft without sending',async()=>{const e=env();e.listeners.pointerdown({button:0,isPrimary:true,pointerId:1,clientY:200,preventDefault(){}});await tick();assert.equal(e.requested,1);assert.equal(e.rec.started,true);e.rec.onresult({results:[[{transcript:'你好'}]]});e.listeners.pointerup({pointerId:1});assert.equal(e.input.value,'原草稿\n你好');assert.equal(e.input.readOnly,false);assert.equal(e.stopped,1);e.controller.destroy()});
test('release while permission pending stops late microphone, never starts recognition',async()=>{let grant,stops=0;const e=env(()=>new Promise(r=>grant=r));e.controller.start();e.controller.finish();grant({getTracks:()=>[{stop(){stops++}}]});await tick();assert.equal(stops,1);assert.equal(e.rec,undefined);assert.equal(e.input.value,'原草稿');e.controller.destroy()});
test('slide up cancels and discards interim transcript',async()=>{const e=env();e.listeners.pointerdown({button:0,pointerId:1,clientY:200,preventDefault(){}});await tick();e.rec.onresult({results:[[{transcript:'取消这句'}]]});e.listeners.pointermove({pointerId:1,clientY:100});e.listeners.pointerup({pointerId:1});assert.equal(e.input.value,'原草稿');assert.equal(e.rec.aborted,true);e.controller.destroy()});
test('denied permissions keep existing draft and clear busy state',async()=>{const e=env(()=>Promise.reject(Object.assign(Error(),{name:'NotAllowedError'})));e.controller.start();await tick();assert.match(e.status,/权限/);assert.equal(e.input.value,'原草稿');assert.equal(e.input.readOnly,false);e.controller.destroy()});
