import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {voiceIdentity,sharedVoiceKey,seal,unseal} from './server/ade-voice-envelope.mjs';

const endpoint='https://limao-zhoudou-81.hybrid-klvvc-7155.chatgpt.site/api/ade/voice-host';
const local='http://127.0.0.1:4193';
const [python,model]=process.argv.slice(2);
const token=process.env.ADE_VOICE_HOST_TOKEN;
if(!python||!model||!token)throw Error('Missing voice host configuration');
delete process.env.ADE_VOICE_HOST_TOKEN;
const localToken=randomBytes(32).toString('hex');
const identity=await voiceIdentity();
const synthesizer=spawn(python,['-u',fileURLToPath(new URL('./serve_selected_voice.py',import.meta.url)),'--model',model,'--port','4193'],{
  windowsHide:true,stdio:['ignore','ignore','inherit'],env:{...process.env,ADE_TTS_TOKEN:localToken}
});
synthesizer.on('exit',()=>process.exit(1));
process.on('exit',()=>synthesizer.kill());
async function report(op,data={}){
  const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({op,peer:identity.publicKey,...data}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Site HTTP '+response.status);
  return response.json();
}
async function perform(job){
  const key=await sharedVoiceKey(identity.privateKey,job.peer);
  const text=new TextDecoder().decode(await unseal(key,job.id,job.payload));
  const response=await fetch(local+'/tts',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+localToken},body:JSON.stringify({text,voice:'05',voice_id:'Y07'}),signal:AbortSignal.timeout(140000)});
  if(!response.ok||response.headers.get('X-Ade-Voice')!=='05-Y07'||!response.headers.get('Content-Type')?.startsWith('audio/wav'))throw Error('Synthesis failed');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<46||bytes.byteLength>1300000)throw Error('Invalid audio length');
  const payload=await seal(key,job.id,bytes);
  for(let i=0;;i++){try{await report('done',{id:job.id,payload});return;}catch(e){if(i>=2)throw e;await sleep(1000);}}
}
for(;;){
  try{
    const health=await fetch(local,{signal:AbortSignal.timeout(2000)});
    if(health.ok&&(await health.json()).voice_id==='Y07')break;
  }catch{}
  await sleep(1500);
}
let lastError='';
for(;;){
  try{
    const {job}=await report('poll');
    if(lastError){console.log('Voice host connected');lastError='';}
    if(!job){await sleep(5000);continue;}
    const heartbeat=setInterval(()=>report('heartbeat').catch(()=>{}),20000);
    try{await perform(job);}catch{await report('failed',{id:job.id});}finally{clearInterval(heartbeat);}
  }catch(error){
    const reason=/^Site HTTP \d+$/.test(error.message)?error.message:'Connection unavailable';
    if(lastError!==reason){console.error(reason);lastError=reason;}
    await sleep(8000);
  }
}
