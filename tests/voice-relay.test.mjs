import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleTts} from '../src/server/ade-tts.mjs';
import {handleVoiceHost} from '../src/server/ade-voice-relay.mjs';
import {voiceIdentity,sharedVoiceKey,seal,unseal} from '../src/server/ade-voice-envelope.mjs';

test('production schema round trip, offline readiness, host auth and confidential queue',async()=>{
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../src/server/ade-voice-relay.sql',import.meta.url),'utf8'));
  const db={prepare(sql){return {bind(...args){const s=sqlite.prepare(sql);return {first:async()=>s.get(...args),run:async()=>({meta:s.run(...args)})};}};},batch:async items=>Promise.all(items.map(s=>s.run()))};
  const url='https://test.invalid/api/ade/tts',token='unit-test';
  const health=async()=>(await (await handleTts(new Request(url),{db})).json()).ready;
  const identity=await voiceIdentity();
  const host=async(data,secret=token)=>handleVoiceHost(new Request(url,{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({peer:identity.publicKey,...data})}),db,token);
  assert.equal(await health(),false);
  assert.equal((await host({op:'poll'},'wrong')).status,403);
  await host({op:'heartbeat'});assert.equal(await health(),true);
  const insert=sqlite.prepare('INSERT INTO ade_voice_job VALUES(?,?,?,?,?,?)');
  for(let i=0;i<5;i++){
    insert.run('finished-'+i,identity.publicKey,'','', 'done',Date.now()+60000);
    insert.run('old-host-'+i,'old-host','','','waiting',Date.now()+60000);
  }
  const answer='今天一起去划船。';
  const output=handleTts(new Request(url,{method:'POST',body:JSON.stringify({text:answer})}),{db});
  let job;
  for(let i=0;i<20&&!job;i++){await new Promise(r=>setTimeout(r,20));job=(await(await host({op:'poll'})).json()).job;}
  assert.ok(job);assert.ok(!job.payload.includes(answer));
  assert.equal((await(await host({op:'poll'})).json()).job,null);
  const key=await sharedVoiceKey(identity.privateKey,job.peer);
  assert.equal(new TextDecoder().decode(await unseal(key,job.id,job.payload)),answer);
  await host({op:'done',id:job.id,payload:await seal(key,job.id,new TextEncoder().encode('RIFF-test'))});
  const response=await output;assert.equal(response.status,200);assert.equal(response.headers.get('X-Ade-Voice'),'05-Y07');assert.equal(await response.text(),'RIFF-test');
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM ade_voice_job WHERE state='working'").get().n,0);
  sqlite.close();
});
