fetch('/voice-i/manifest.json').then(r=>{if(!r.ok)throw Error('无法读取声音清单');return r.json();}).then(data=>{
 if(data.voice!=='I'||data.voice_id!=='M09')throw Error('声线不匹配');
 document.querySelector('#status').textContent=`已加载 ${data.clips.length} 段 I / M09 音频`;
 for(const clip of data.clips){const row=document.createElement('article'),text=document.createElement('p'),audio=document.createElement('audio');text.textContent=clip.text;audio.controls=true;audio.preload='none';audio.src=clip.src;audio.setAttribute('aria-label',clip.text);audio.addEventListener('play',()=>document.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause();}));row.append(text,audio);document.querySelector('#clips').append(row);}
}).catch(error=>document.querySelector('#status').textContent=error.message);
