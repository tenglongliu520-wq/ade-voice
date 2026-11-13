(() => {
 'use strict';
 const keyboardInput=window.adeInputMethod!=='legacy';
 const $=s=>document.querySelector(s),avatar=new CompanionAvatar($('#avatar')),log=$('#messages'),input=$('#input');
 let service={ready:false,asr:false,tts:false},history=[],busy=false,controller=null,turn=0,voiceMode=false,microphone=null,socket=null,listening=false;
 let audioContext=null,player=null,speechTasks=[],speechRunning=false,speechAbort=null,speechSequence=0,streamDone=true;
 let micStarting=false,recognitionFinishing=false,captureEpoch=0,draftPrefix='',partialText='',reviewPending=false,finishTimer=null,captureTimer=null;
 let recordedPcm=[],recordedBytes=0,asrAbort=null;
 const batchAsr=()=>window.adeBatchAsr===true;
 const setStatus=text=>$('#status').textContent=text;
 function state(mode,text){avatar.setState(mode);$('#avatarCaption').textContent=text;$('#stateText').textContent=text;$('#stateDot').parentElement.classList.toggle('active',mode!=='idle');}
 function controls(){ $('#send').disabled=!service.ready||busy||voiceMode||micStarting;$('#mic').disabled=keyboardInput?busy:!service.asr||!service.ready||busy||micStarting||recognitionFinishing;$('#clear').disabled=busy;$('#stop').disabled=!busy&&!speechRunning&&!speechTasks.length&&!voiceMode&&!micStarting;$('#mic').setAttribute('aria-pressed',String(voiceMode));$('#micLabel').textContent=keyboardInput?'输入法语音':micStarting?'正在打开麦克风…':recognitionFinishing?'正在识别…':voiceMode?'说完了，转文字':reviewPending?'继续录音补充':'语音输入';input.readOnly=voiceMode||micStarting;$('#voiceReview').hidden=!reviewPending;}
 function addMessage(role,text){const article=document.createElement('article');article.className='message '+role;const label=document.createElement('small');label.textContent=role==='user'?'你':'阿德';const body=document.createElement('p');body.textContent=text;article.append(label,body);log.append(article);log.scrollTop=log.scrollHeight;return {article,body};}
 function resetRecognizer(){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({reset:true}));}
 function resumeListening(){if(voiceMode&&!recognitionFinishing&&!busy&&streamDone&&!speechRunning&&!speechTasks.length){resetRecognizer();listening=true;state('listen','嗯，我在听，慢慢说');setStatus('正在录音，说完后转成文字；校对后由你点击发送。');}controls();}
 function stopSpeech(){speechSequence++;speechAbort?.abort();speechAbort=null;speechTasks=[];if(player){player.pause();player=null;}avatar.analyser=null;speechRunning=false;state('idle','我在这里，慢慢来');controls();}
 function unlockAudio(){try{if(!audioContext){const Context=window.AudioContext||window.webkitAudioContext;audioContext=new Context();}audioContext.resume().catch(()=>{});const source=audioContext.createBufferSource();source.buffer=audioContext.createBuffer(1,1,22050);source.connect(audioContext.destination);source.start();}catch{}}
 function cleanSpeech(text){return text.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/[*#`]/g,'').trim();}
 function queueSpeech(text){text=cleanSpeech(text);if(!/[\p{L}\p{N}]/u.test(text)||document.hidden||!$('#autoSpeak').checked||!service.tts)return;speechTasks.push(text);consumeSpeech();}
 async function consumeSpeech(){
  if(speechRunning||!speechTasks.length)return;
  speechRunning=true;listening=false;const sequence=speechSequence;controls();
  while(speechTasks.length&&sequence===speechSequence){
   const text=speechTasks.shift();speechAbort=new AbortController();
   try{
    if(!audioContext){const Context=window.AudioContext||window.webkitAudioContext;audioContext=new Context();}await audioContext.resume();
    if(!busy)state('think','正在准备声音…');
    let response;
    if(true){
     const manifest=await (await fetch('/voice-i/manifest.json')).json();
     const normalize=value=>value.replace(/\s+/g,'').replace(/[“”]/g,'"');
     const clip=manifest.voice==='I'&&manifest.clips.find(item=>normalize(item.text)===normalize(text));
     if(!clip){setStatus('这条新回答尚未配好I语音，请先看文字。');continue;}
     response=await fetch(clip.src,{signal:speechAbort.signal});
    }else response=await fetch('/api/ade/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:speechAbort.signal});
    if(!response.ok)throw Error('声音暂时未能播放，可稍后点击重听');
    const blob=await response.blob();if(sequence!==speechSequence)break;
    const buffer=await audioContext.decodeAudioData(await blob.arrayBuffer());if(sequence!==speechSequence)break;
    const source=audioContext.createBufferSource(),analyser=audioContext.createAnalyser();source.buffer=buffer;analyser.fftSize=256;source.connect(analyser);analyser.connect(audioContext.destination);avatar.analyser=analyser;
    const current={pause:()=>{try{source.stop();}catch{}}};player=current;const segmentAbort=speechAbort;
    try{await new Promise((resolve,reject)=>{source.onended=resolve;segmentAbort.signal.addEventListener('abort',()=>{current.pause();resolve();},{once:true});try{source.start();state('talk','阿德正在回答…');setStatus('正在朗读，可以随时停止。');}catch(e){reject(e);}});}finally{source.disconnect();analyser.disconnect();if(player===current)player=null;if(avatar.analyser===analyser)avatar.analyser=null;}
   }catch(error){if(error.name!=='AbortError')setStatus(error.message||'浏览器暂未播放声音，点击回答下方“重听”即可。');}
  }
  if(sequence===speechSequence){speechRunning=false;speechAbort=null;if(!busy)state('idle','还有什么想和我说的？');controls();resumeListening();}
 }
 function addReplay(entry,text){const button=document.createElement('button');button.type='button';button.className='replay';button.textContent='▷ 重听这条回答';button.onclick=()=>{unlockAudio();listening=false;stopSpeech();$('#autoSpeak').checked=true;queueSpeech(text);};entry.article.append(button);}
 async function send(text){
  text=text.trim();if(!text||busy||!service.ready||voiceMode||micStarting)return;
  if(input.maxLength>0&&text.length>input.maxLength){setStatus('文字超过'+input.maxLength+'字，草稿已完整保留，请精简后再发送。');return;}
  reviewPending=false;
  unlockAudio();listening=false;resetRecognizer();stopSpeech();busy=true;streamDone=false;const ticket=++turn;controls();$('#prompts').hidden=true;
  addMessage('user',text);input.value='';state('think','阿德正在想…');setStatus('阿德正在想你的问题…');const entry=addMessage('assistant','…');
  const requestHistory=[...history,{role:'user',content:text}].slice(-21);if(requestHistory[0]?.role==='assistant')requestHistory.shift();
  let answer='',speechPending='';controller=new AbortController();let failed=false;
  try{
   const response=await fetch('/api/ade/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:requestHistory}),signal:controller.signal});
   if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.detail||'阿德暂时没能连接，请稍后重试');}
   const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
   while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop();for(const line of lines){if(!line.startsWith('data: '))continue;const packet=JSON.parse(line.slice(6));if(packet.error)throw Error(packet.error);if(packet.delta){answer+=packet.delta;speechPending+=packet.delta;entry.body.textContent=answer;log.scrollTop=log.scrollHeight;const match=speechPending.match(/^([\s\S]{8,}?[。！？\n])/);if(match){queueSpeech(match[1]);speechPending=speechPending.slice(match[1].length);}else if(speechPending.length>=65){const comma=speechPending.slice(18,65).lastIndexOf('，');const cut=comma>=0?comma+19:55;queueSpeech(speechPending.slice(0,cut));speechPending=speechPending.slice(cut);}}}}
   if(!answer.trim())throw Error('这次没有生成回答，请重试');
   queueSpeech(speechPending);history=[...requestHistory,{role:'assistant',content:answer}].slice(-20);addReplay(entry,answer);setStatus('回答完成，可以继续追问。');
  }catch(error){failed=true;if(answer){history=[...requestHistory,{role:'assistant',content:answer}].slice(-20);addReplay(entry,answer);}else{entry.body.textContent=error.name==='AbortError'?'已停止这次回答。':'这次没能完成回答，请再试一次。';input.value=[text,input.value].filter(Boolean).join('\n');}setStatus(error.name==='AbortError'?'已停止回答。':error.message);}
  finally{if(ticket===turn){busy=false;streamDone=true;controller=null;if(!speechRunning)state('idle','我在这里，慢慢来');controls();if(!failed)resumeListening();}}
 }
 function combineDraft(text){return [draftPrefix.trimEnd(),String(text||'').trim()].filter(Boolean).join('\n');}
 function reviewTranscript(text,notice){
  input.value=combineDraft(text);reviewPending=!!String(text||'').trim();endVoice();
  state('idle',reviewPending?'先看看文字，改好再发送':'我在这里，慢慢来');
  setStatus(notice||(reviewPending?'语音已转成草稿，请校对或修改，点击发送后阿德才会回答。':'没有识别到清楚的内容，原有文字已保留，可以重新录音。'));
  input.focus();input.setSelectionRange(input.value.length,input.value.length);controls();
 }
 async function openSocket(){
  return new Promise((resolve,reject)=>{const ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/api/listen');socket=ws;
   let opened=false;const connecting=setTimeout(()=>{ws.close();reject(Error('语音连接超时，请重试。'));},10000);
   ws.onopen=()=>{clearTimeout(connecting);opened=true;resolve();};ws.onerror=()=>{clearTimeout(connecting);reject(Error('语音连接暂时中断'));};
   ws.onmessage=event=>{
    if(socket!==ws||!voiceMode||(!listening&&!recognitionFinishing))return;
    let data;try{data=JSON.parse(event.data);}catch{return;}
    if(data.processing){setStatus('正在核对语音文字，请稍等…');return;}
    if(data.error){reviewTranscript(partialText,'识别暂时中断，已保留草稿；请校对后手动发送，或重新录音。');return;}
    if(data.partial!==undefined&&!recognitionFinishing){partialText=data.partial;input.value=combineDraft(partialText);if(partialText)setStatus('正在识别，说完后可先修改文字，不会自动发送。');}
    if(data.final){reviewTranscript(data.text||'',data.needs_review?'部分字词可能不准确，请重点校对，再点击发送。':undefined);}
   };
   ws.onclose=()=>{clearTimeout(connecting);if(!opened)reject(Error('语音连接已关闭，请重试。'));if(socket===ws){socket=null;if(voiceMode)reviewTranscript(partialText,'语音连接已断开，原有文字及已识别草稿已保留，请校对后手动发送。');}};
  });
 }
 function finishVoiceInput(){
  if(!voiceMode||recognitionFinishing)return;
  recognitionFinishing=true;listening=false;clearTimeout(captureTimer);controls();setStatus('正在识别最后几个字，请稍等；完成后先校对文字。');
  // Flush the final incomplete audio packet before asking the recognizer to finish.
  microphone?.worklet.port.postMessage({flush:true});
  finishTimer=setTimeout(()=>{if(voiceMode)reviewTranscript(partialText,'识别等待超时，已保留草稿；请校对后发送，或重新录音。');},batchAsr()?45000:15000);
 }
 async function transcribeRecording(epoch){
  const size=Math.min(recordedBytes,960000);
  if(size<6400){reviewTranscript('','录音太短，请再说一次；原有文字已保留。');return;}
  const wav=new ArrayBuffer(44+size),view=new DataView(wav);const word=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  word(0,'RIFF');view.setUint32(4,36+size,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,size,true);
  let offset=44;for(const chunk of recordedPcm){const count=Math.min(chunk.byteLength,wav.byteLength-offset);if(count<=0)break;new Uint8Array(wav,offset,count).set(new Uint8Array(chunk,0,count));offset+=count;}
  recordedPcm=[];recordedBytes=0;asrAbort=new AbortController();
  // Stop the physical microphone while the local model transcribes the upload.
  microphone?.stream.getTracks().forEach(track=>track.stop());
  try{
   const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav,signal:asrAbort.signal});
   const result=await response.json();if(epoch!==captureEpoch||!voiceMode)return;
   if(!response.ok)throw Error(result.detail||'语音识别暂时失败，请重试。');
   reviewTranscript(result.text||'',result.needs_review?'部分字词可能不准确，请校对修改后点击发送。':undefined);
  }catch(error){if(epoch===captureEpoch&&voiceMode)reviewTranscript(partialText,error.name==='AbortError'?'识别已取消，原有草稿已保留。':error.message||'识别失败，请重试；原有草稿已保留。');}
 }
 async function beginVoice(){
  if(!window.AudioWorkletNode){setStatus('这个浏览器暂不支持连续语音，请用手机系统浏览器打开，也可直接输入文字。');return;}
  unlockAudio();
  if(busy||micStarting)return;
  if(!navigator.mediaDevices?.getUserMedia){setStatus('当前浏览器未开放麦克风，请用系统浏览器打开此 HTTPS 页面。');return;}
  const epoch=++captureEpoch;micStarting=true;listening=false;draftPrefix=input.value;partialText='';recordedPcm=[];recordedBytes=0;stopSpeech();controls();
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(epoch!==captureEpoch){stream.getTracks().forEach(track=>track.stop());return;}
   microphone={stream};const Context=window.AudioContext||window.webkitAudioContext,context=new Context();microphone.context=context;await context.resume();await context.audioWorklet.addModule('/assets/mic-worklet.js');
   if(epoch!==captureEpoch)return;
   const source=context.createMediaStreamSource(stream),worklet=new AudioWorkletNode(context,'pcm-capture'),mute=context.createGain();mute.gain.value=0;source.connect(worklet);worklet.connect(mute);mute.connect(context.destination);microphone.source=source;microphone.worklet=worklet;
   if(!batchAsr())await openSocket();if(epoch!==captureEpoch)return;voiceMode=true;micStarting=false;
   worklet.port.onmessage=event=>{
    if(!voiceMode||epoch!==captureEpoch)return;
    if(batchAsr()){
     if(event.data?.flushed){if(recognitionFinishing)transcribeRecording(epoch);return;}
     if((listening||recognitionFinishing)&&event.data instanceof ArrayBuffer&&recordedBytes<960000){recordedPcm.push(event.data);recordedBytes+=event.data.byteLength;}
     return;
    }
    if(socket?.readyState!==WebSocket.OPEN)return;if(event.data?.flushed){if(recognitionFinishing)socket.send(JSON.stringify({finish:true}));return;}if(listening||recognitionFinishing)socket.send(event.data);
   };
   worklet.port.postMessage({reset:true});captureTimer=setTimeout(finishVoiceInput,30000);resumeListening();
  }catch(error){if(epoch===captureEpoch){endVoice();setStatus(error.name==='NotAllowedError'?'麦克风权限未开启，可以在浏览器允许后再试，也可以输入文字。':error.message||'麦克风暂时无法使用。');}}finally{if(epoch===captureEpoch)micStarting=false;controls();}
 }
 function endVoice(){captureEpoch++;clearTimeout(finishTimer);clearTimeout(captureTimer);asrAbort?.abort();asrAbort=null;recordedPcm=[];recordedBytes=0;voiceMode=false;micStarting=false;recognitionFinishing=false;listening=false;const currentSocket=socket;socket=null;currentSocket?.close();if(microphone){microphone.source?.disconnect();microphone.worklet?.disconnect();microphone.stream.getTracks().forEach(t=>t.stop());microphone.context?.close();microphone=null;}controls();if(!busy&&!speechRunning)state('idle','我在这里，慢慢来');}
 $('#form').onsubmit=event=>{event.preventDefault();send(input.value);};input.onkeydown=event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){event.preventDefault();send(input.value);}};
 input.oninput=()=>{if(!input.value.trim())reviewPending=false;controls();};
 $('#mic').onclick=()=>{if(keyboardInput){stopSpeech();input.readOnly=false;input.focus();setStatus('请点击手机输入法中的麦克风，说完后校对文字，再点击发送。没有语音按钮时可直接打字。');return;}if(voiceMode)finishVoiceInput();else beginVoice();};
 $('#stop').onclick=()=>{if(voiceMode)reviewTranscript(partialText,'已停止录音，草稿已保留，请校对后点击发送。');else endVoice();controller?.abort();stopSpeech();setStatus('已停止；输入框中的文字可修改后手动发送。');};
 $('#autoSpeak').onchange=()=>{if(!$('#autoSpeak').checked){stopSpeech();resumeListening();}};
 $('#clear').onclick=()=>{if(busy)return;endVoice();stopSpeech();history=[];log.replaceChildren();addMessage('assistant','重新开始啦。今天有什么想和我聊的吗？');$('#prompts').hidden=false;input.value='';reviewPending=false;controls();setStatus('当前对话已清空。');};
 $('#motion').onclick=event=>{const paused=event.currentTarget.getAttribute('aria-pressed')!=='true';avatar.setPaused(paused);event.currentTarget.setAttribute('aria-pressed',String(paused));event.currentTarget.textContent=paused?'开启动作':'暂停人物动作';};
 $('#prompts').querySelectorAll('button').forEach(button=>button.onclick=()=>send(button.textContent));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(voiceMode)reviewTranscript(partialText,'录音已暂停，草稿已保留；回来后请校对再发送。');else endVoice();stopSpeech();}});window.addEventListener('pagehide',()=>{endVoice();controller?.abort();stopSpeech();});
 async function check(){try{await window.adeReady;const response=await fetch('/api/ade/chat');service=await response.json();$('#connection').textContent=service.ready?'● 阿德已连接':'● 阿德正在上线…';$('#connection').classList.toggle('ready',service.ready);if(service.ready){state('idle','你好，我是阿德 ♡');setStatus('可以打字，或用输入法语音转文字，校对后点击发送。');}else{setStatus('问答服务暂未就绪，请稍后重试。');setTimeout(check,4000);}$('#autoSpeak').disabled=!service.tts;controls();}catch(error){setStatus(error.message||'阿德主机暂时离线，请稍后刷新。');if(!/完整|邀请码/.test(error.message||''))setTimeout(check,6000);}}
 check();
})();
