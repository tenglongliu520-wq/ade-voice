import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {handleTts} from '../src/server/ade-tts.mjs';
const request=text=>new Request('https://site.test/api/ade/tts',{method:'POST',headers:{origin:'https://site.test'},body:JSON.stringify({text})});
const config={url:'https://voice.test/tts',token:'test-only'};
test('unconfigured service gives actionable status and never claims ready',async()=>{
 assert.equal((await (await handleTts(new Request('https://site.test/api/ade/tts'))).json()).ready,false);
 assert.equal((await handleTts(request('你好'))).status,503);
});
test('new answer is sent to selected 05/Y07 synthesis with server-only auth',async()=>{
 const r=await handleTts(request('新的回答'),config,async(url,options)=>{assert.equal(url,config.url);assert.equal(options.headers.Authorization,'Bearer test-only');assert.deepEqual(JSON.parse(options.body),{text:'新的回答',voice:'05',voice_id:'Y07'});return new Response('RIFF-test',{headers:{'Content-Type':'audio/wav','X-Ade-Voice':'05-Y07'}})});
 assert.equal(r.status,200);assert.equal(r.headers.get('X-Ade-Voice'),'05-Y07');assert.equal(await r.text(),'RIFF-test');
});
test('rejects invalid requests before synthesis',async()=>{
 for(const text of ['',null,'x'.repeat(1601)])assert.equal((await handleTts(request(text),config)).status,400);
 assert.equal((await handleTts(new Request('https://site.test/api/ade/tts',{method:'POST',headers:{origin:'https://foreign.test'}}),config)).status,403);
});
test('wrong voice and provider failures cannot leak or play another voice',async()=>{
 for(const response of [new Response('secret',{status:500}),new Response('secret',{headers:{'Content-Type':'audio/wav','X-Ade-Voice':'other'}}),new Response('secret',{headers:{'Content-Type':'text/html','X-Ade-Voice':'05-Y07'}})]){const r=await handleTts(request('你好'),config,async()=>response);assert.ok(r.status>=500);assert.doesNotMatch(await r.text(),/secret|test-only/);}
});
function player(failure=false){
 const nodes=new Map(),calls=[];const node=()=>({textContent:'',checked:true,disabled:false,setAttribute(){},classList:{toggle(){}},parentElement:{classList:{toggle(){}}}});
 const document={hidden:false,querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)}};
 let played=0;class Context{state='running';resume(){return Promise.resolve()}createBuffer(){return {}}createBufferSource(){return {connect(){},disconnect(){},start(){played++;queueMicrotask(()=>this.onended?.())},stop(){this.onended?.()}}}createAnalyser(){return {connect(){},disconnect(){}}}decodeAudioData(){return Promise.resolve({})}}
 const source=fs.readFileSync(new URL('../src/frontend/cloud-chat.js',import.meta.url),'utf8');
 const prefix=source.slice(0,source.indexOf(' async function send('));
 const sandbox={window:{AudioContext:Context},document,CompanionAvatar:class{setState(){}},AbortController,queueMicrotask,fetch:async(url,options)=>{calls.push({url,options});if(url.includes('manifest'))return {ok:true,json:async()=>({voice:'05',voice_id:'Y07',clips:[{text:'预录回答',src:'/voice-05/clip.wav'}]})};return failure?{ok:false,json:async()=>({detail:'语音服务尚未连接'})}:{ok:true,blob:async()=>({arrayBuffer:async()=>new ArrayBuffer(8)})}}};
 vm.runInNewContext(prefix+'service.tts=true;window.test={queueSpeech,stopSpeech};})();',sandbox);
 return {sandbox,calls,nodes,get played(){return played}};
}
const settle=()=>new Promise(r=>setTimeout(r,20));
test('player keeps prerecorded voice and synthesizes unseen AI text',async()=>{
 const p=player();p.sandbox.window.test.queueSpeech('新的AI回答');await settle();assert.ok(p.calls.some(c=>c.url==='/api/ade/tts'&&JSON.parse(c.options.body).text==='新的AI回答'));assert.equal(p.played,1);
 p.calls.length=0;p.sandbox.window.test.queueSpeech('预录回答');await settle();assert.ok(p.calls.some(c=>c.url==='/voice-05/clip.wav'));assert.ok(!p.calls.some(c=>c.url==='/api/ade/tts'));
});
test('player surfaces service errors and honors disabled auto speak',async()=>{
 const p=player(true);p.sandbox.window.test.queueSpeech('新回答');await settle();assert.match(p.nodes.get('#status').textContent,/尚未连接/);assert.equal(p.played,0);
 p.calls.length=0;p.nodes.get('#autoSpeak').checked=false;p.sandbox.window.test.queueSpeech('不应朗读');await settle();assert.equal(p.calls.length,0);
});
