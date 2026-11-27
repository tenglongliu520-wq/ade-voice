import {voiceIdentity, sharedVoiceKey, seal, unseal} from './ade-voice-envelope.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function liveVoice(db) {
  return db.prepare('SELECT peer FROM ade_voice_host WHERE id=1 AND seen>?').bind(Date.now()-60000).first();
}
export async function pullSynthesis(request,db,text) {
  const host=await liveVoice(db);
  if(!host)return json({detail:'阿德的语音主机暂时离线，文字回答已保留，恢复后可点重听。'},503);
  const id=crypto.randomUUID(), identity=await voiceIdentity();
  const key=await sharedVoiceKey(identity.privateKey,host.peer);
  const payload=await seal(key,id,new TextEncoder().encode(text));
  const now=Date.now(), deadline=now+155000;
  const written=await db.prepare(`INSERT INTO ade_voice_job(id,host,peer,payload,state,expires)
    SELECT ?,?,?,?,'waiting',? WHERE (SELECT count(*) FROM ade_voice_job
      WHERE host=? AND state IN ('waiting','working') AND expires>?)<5`)
    .bind(id,host.peer,identity.publicKey,payload,now+35000,host.peer,now).run();
  if(!written.meta.changes)return json({detail:'阿德正在朗读其他回答，请稍后重听。'},429);
  try{
    while(Date.now()<deadline && !request.signal.aborted){
      await delay(3500);
      const result=await db.prepare("SELECT state,CASE WHEN state='done' THEN payload END AS payload,expires FROM ade_voice_job WHERE id=?").bind(id).first();
      if(!result||result.expires<=Date.now())return json({detail:'阿德的语音排队超时，可以重听或使用设备声音。'},429);
      if(result.state==='waiting'||result.state==='working')continue;
      if(result.state==='failed')return json({detail:'这段语音合成失败，请点击重听。'},503);
      const audio=await unseal(key,id,result.payload);
      return new Response(audio,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Ade-Voice':'05-Y07','X-Content-Type-Options':'nosniff'}});
    }
    return json({detail:'本次语音等待超时，请点击重听。'},504);
  }finally{await db.prepare('DELETE FROM ade_voice_job WHERE id=?').bind(id).run();}
}
export async function handleVoiceHost(request,db,token) {
  if(!db||!token||request.method!=='POST')return json({},404);
  const encoder=new TextEncoder();
  const digest=value=>crypto.subtle.digest('SHA-256',encoder.encode(value));
  const a=new Uint8Array(await digest(request.headers.get('Authorization')||''));
  const b=new Uint8Array(await digest('Bearer '+token));
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  if(diff)return json({},403);
  let message;
  try{message=await request.json();}catch{return json({},400);}
  const {op,peer,id,payload}=message||{}, now=Date.now();
  if(typeof peer!=='string'||!/^[A-Za-z0-9+/]{87}=$/.test(peer))return json({},400);
  if(op==='poll'||op==='heartbeat'){
    await db.batch([db.prepare('DELETE FROM ade_voice_job WHERE expires<=?').bind(now),
      db.prepare('INSERT INTO ade_voice_host(id,peer,seen) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET peer=excluded.peer,seen=excluded.seen').bind(peer,now)]);
    if(op==='heartbeat')return json({});
    const job=await db.prepare(`UPDATE ade_voice_job SET state='working',expires=? WHERE id=(
      SELECT id FROM ade_voice_job WHERE state='waiting' AND host=? AND expires>? ORDER BY expires LIMIT 1)
      RETURNING id,peer,payload`).bind(now+140000,peer,now).first();
    return json({job:job||null});
  }
  if((op!=='done'&&op!=='failed')||typeof id!=='string'||id.length!==36)return json({},400);
  if(op==='done'&&(typeof payload!=='string'||payload.length>1800000))return json({},400);
  await db.prepare("UPDATE ade_voice_job SET state=?,payload=? WHERE id=? AND host=? AND state='working' AND expires>?")
    .bind(op,op==='done'?payload:'',id,peer,now).run();
  return json({});
}
