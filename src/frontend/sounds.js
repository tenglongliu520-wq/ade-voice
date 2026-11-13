(() => {
 const avatar=new CompanionAvatar(document.querySelector('#soundAvatar'));
 const status=document.querySelector('#soundStatus'),stop=document.querySelector('#stopSound'),volume=document.querySelector('#soundVolume');
 let audio=null,selected=null,serial=0,audioContext=null;
 function reset(){avatar.analyser=null;if(audio){audio.pause();audio.currentTime=0;audio=null;}selected?.setAttribute('aria-pressed','false');selected?.querySelector('.sound-play')?.replaceChildren(document.createTextNode('▶ 点击试听'));selected=null;stop.disabled=true;avatar.setState('idle');}
 stop.onclick=()=>{serial++;reset();status.textContent='试听已停止';};
 volume.oninput=()=>{if(audio)audio.volume=+volume.value;};
 document.querySelector('#pauseAvatar').onclick=e=>{const paused=e.currentTarget.getAttribute('aria-pressed')!=='true';avatar.setPaused(paused);e.currentTarget.setAttribute('aria-pressed',paused);e.currentTarget.textContent=paused?'开启动作':'暂停动作';};
 fetch('/sounds/manifest.json?v=20261105-e').then(r=>{if(!r.ok)throw Error();return r.json();}).then(items=>{
  for(const item of items){
   const b=document.createElement('button');b.className='sound-card';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','试听'+item.title);
   b.innerHTML='<span class="sound-wave" aria-hidden="true"><i></i><i></i><i></i></span><strong></strong><small></small><span class="sound-play">▶ 点击试听</span>';
   const faces={hello:'wave',listen:'nod',encourage:'ready',calm:'calm',think:'speechless',celebrate:'celebrate',comfort:'hug',goodnight:'rest'};b.querySelector('.sound-wave').replaceWith(window.AdeExpressions.image(faces[item.id]||'smile','sound-expression'));b.querySelector('strong').textContent=item.title;b.querySelector('small').textContent=item.description;
   b.onclick=async()=>{const same=selected===b;const ticket=++serial;reset();if(same){status.textContent='试听已停止';return;}selected=b;audio=new Audio(item.src);audio.volume=+volume.value;const current=audio;
    b.setAttribute('aria-pressed','true');b.querySelector('.sound-play').textContent='■ 停止试听';stop.disabled=false;
    current.onended=()=>{if(ticket!==serial)return;reset();status.textContent=item.title+' 播放完毕，再听听其他心情吧';};
    current.onerror=()=>{if(ticket!==serial)return;reset();status.textContent='这段声音暂时未加载成功，请重试';};
    try{const Context=window.AudioContext||window.webkitAudioContext;audioContext||=new Context();await audioContext.resume();const source=audioContext.createMediaElementSource(current),analyser=audioContext.createAnalyser();analyser.fftSize=256;source.connect(analyser);analyser.connect(audioContext.destination);avatar.analyser=analyser;await current.play();if(ticket!==serial)return;avatar.setState(item.voice==='I'?'talk':item.motion);status.textContent='正在试听 '+item.title+' · 阿德I声线';}catch{if(ticket!==serial)return;reset();status.textContent='未能播放，请再次点击试听';}
   };document.querySelector('#soundGrid').append(b);
  }
 }).catch(()=>status.textContent='音效清单未能加载，请刷新重试');
 document.addEventListener('visibilitychange',()=>{if(document.hidden){serial++;reset();status.textContent='已暂停试听';}});
})();
