/* One selected synthetic character 05 / Y07; never fall back to device voices. */
(() => {
 const normalize=text=>String(text).replace(/\s+/g,'').replace(/[“”]/g,'"');
 let clips=[];
 const ready=fetch('/voice-05/manifest.json?v=20261120').then(async response=>{if(!response.ok)throw Error('05号声音加载失败');const data=await response.json();if(data.voice!=='05'||data.voice_id!=='Y07')throw Error('声线不匹配');clips=data.clips.map(item=>({...item,key:normalize(item.text)})).sort((a,b)=>b.key.length-a.key.length);return data;});
 async function plan(text){
  await ready;let remaining=normalize(text),result=[];
  while(remaining){const clip=clips.find(item=>remaining.startsWith(item.key));if(!clip)return [];result.push(clip.src);remaining=remaining.slice(clip.key.length);}
  return result;
 }
 async function* audio(text,signal){
  const planClips=await plan(text);if(planClips.length){for(const src of planClips)yield {src};return;}
  for(let i=0;i<text.length;i+=24){const r=await fetch('/api/ade/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.slice(i,i+24)}),signal});if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.detail||'05号声音暂未生成，请重试');}yield {blob:await r.blob()};}
 }
 window.AdeVoice={ready,plan,audio,voice:'05',voiceId:'Y07'};
})();
