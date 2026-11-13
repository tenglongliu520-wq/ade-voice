/* One selected synthetic character I / M09; never fall back to device voices. */
(() => {
 const normalize=text=>String(text).replace(/\s+/g,'').replace(/[“”]/g,'"');
 let clips=[];
 const ready=fetch('/voice-i/manifest.json?v=20261105-e').then(async response=>{if(!response.ok)throw Error('I声线加载失败');const data=await response.json();if(data.voice!=='I'||data.voice_id!=='M09')throw Error('声线不匹配');clips=data.clips.map(item=>({...item,key:normalize(item.text)})).sort((a,b)=>b.key.length-a.key.length);return data;});
 async function plan(text){
  await ready;let remaining=normalize(text),result=[];
  while(remaining){const clip=clips.find(item=>remaining.startsWith(item.key));if(!clip)return [];result.push(clip.src);remaining=remaining.slice(clip.key.length);}
  return result;
 }
 window.AdeVoice={ready,plan,voice:'I',voiceId:'M09'};
})();
