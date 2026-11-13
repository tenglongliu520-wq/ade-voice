(() => {
 const $=s=>document.querySelector(s),avatar=new CompanionAvatar($('#chatAvatar'));
 const log=$('#chatLog'),input=$('#chatInput'),status=$('#chatStatus'),caption=$('#avatarCaption');
 let service={ready:false,asr:false,tts:false},history=[],catalog=[],lastScene=null,busy=false,controller=null,voice=null,recording=null,serial=0,speechController=null,preparing=false,audioContext=null;
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const API='/companion-api/';
 function mode(value,message){avatar.setState(value);caption.textContent=message;}
 function message(role,content){const e=document.createElement('article');e.className='chat-message '+role;const label=document.createElement('small');label.textContent=role==='user'?'你':'阿德';const body=document.createElement('div');body.textContent=content;e.append(label,body);log.append(e);e.scrollIntoView({block:'nearest',behavior:'auto'});return {element:e,body};}
 function controls(){ $('#chatSend').disabled=busy;$('#chatClear').disabled=busy;$('#chatStop').disabled=!busy&&!voice&&!recording&&!preparing;$('#chatRecord').disabled=!service.asr||busy; }
 function stopVoice(){speechController?.abort();speechController=null;preparing=false;if(voice){voice.pause?.();if(voice.src)URL.revokeObjectURL(voice.src);voice=null;}audioContext?.close().catch(()=>{});audioContext=null;avatar.analyser=null;mode('idle','我在这里，慢慢来');controls();}
 async function speak(text){
  if(!service.tts)return;
  const ticket=++serial;stopVoice();preparing=true;mode('think','正在准备阿德的声音…');controls();
  try{
   const plan=await window.AdeVoice.plan(text);
   if(!plan.length)throw Error('这条新回答的I声线尚未准备好，文字已保留。');
   for(const src of plan){
    if(ticket!==serial)return;
    const current=new Audio(src);voice=current;
    try{const Context=window.AudioContext||window.webkitAudioContext;if(!audioContext){audioContext=new Context();await audioContext.resume();}const source=audioContext.createMediaElementSource(current),analyser=audioContext.createAnalyser();analyser.fftSize=256;source.connect(analyser);analyser.connect(audioContext.destination);avatar.analyser=analyser;}catch{}
    await new Promise((resolve,reject)=>{current.onended=resolve;current.onerror=()=>reject(Error('I声音暂未加载成功，文字已保留。'));current.onpause=()=>{if(ticket!==serial)resolve();};current.play().then(()=>{if(ticket===serial){mode('talk','阿德正在回答…');controls();}}).catch(reject);});
   }
   if(ticket===serial){stopVoice();status.textContent='朗读完成，可以继续追问。';}
  }catch(error){if(ticket===serial){stopVoice();status.textContent=error.name==='NotAllowedError'?'点击朗读按钮播放阿德的声音。':error.message;}}
  finally{if(ticket===serial){preparing=false;controls();}}
 }
 function replay(entry,text){if(!service.tts)return;const b=document.createElement('button');b.type='button';b.textContent='▶ 朗读这条回答';b.onclick=()=>{serial++;stopVoice();speak(text);};entry.element.append(b);}
 function practiceAnswer(question){
  if(/(更|再).{0,3}(温柔|委婉|暖)|换一种/.test(question)&&lastScene)return '可以换成温和一点的说法：\n'+lastScene.a2;
  if(/(短|精简|简洁)/.test(question)&&lastScene)return '先用这一句开口：\n'+lastScene.a1;
  const ranks=catalog.map(row=>({row,score:row.keys.reduce((n,k)=>n+(question.includes(k)?k.length:0),0)})).sort((a,b)=>b.score-a.score);
  if(ranks[0]?.score){lastScene=ranks[0].row;return '这是话术库中的一个参考回应：\n'+lastScene.a1+'\n\n你可以追问“更温柔一点”或“再简短一点”。';}
  return '当前是话术练习模式，还不能像实时AI那样自由回答。可以试试“父母催婚”“拒绝借钱”“道德绑架”或“跨部门催进度”。你也可以返回首页搜索全部81个场景。';
 }
 async function send(question){
  question=question.trim();if(!question||busy)return;
  serial++;stopVoice();busy=true;controls();message('user',question);history.push({role:'user',content:question});mode('think','阿德正在想…');
  const answer=message('assistant','');let text='';controller=new AbortController();
  try{
   if(!service.ready){text=practiceAnswer(question);answer.body.textContent=text;}
   else{
    const r=await fetch(API+'chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history.slice(-12)}),signal:controller.signal});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.error||'本地模型暂不可用，请检查本机服务。');}
    const reader=r.body.getReader(),decoder=new TextDecoder();let pending='';
    while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split('\n');pending=lines.pop();for(const line of lines){if(!line.startsWith('data: '))continue;const data=line.slice(6).trim();if(data==='[DONE]')continue;let packet;try{packet=JSON.parse(data);}catch{continue;}if(packet.error)throw Error(packet.error.message||'模型回答中断');const token=packet.choices?.[0]?.delta?.content;if(token){text+=token;answer.body.textContent=text;}}}
    if(!text.trim())throw Error('模型没有返回回答，请重新发送。');
   }
   history.push({role:'assistant',content:text});history=history.slice(-12);input.value='';replay(answer,text);status.textContent=service.ready?'回答完成，可以接着追问。':'话术练习回答已显示，可追问“更温柔一点”。';mode('idle','还有什么想和我说的？');
   if($('#autoSpeak').checked&&service.tts)speak(text);
  }catch(e){answer.body.textContent=text||'这次没有完成回答，问题仍保留在输入框中。';status.textContent=e.name==='AbortError'?'已停止回答。':e.message;if(text)history.push({role:'assistant',content:text});else history.pop();mode('idle','没关系，我们可以再试一次');}
  finally{busy=false;controller=null;controls();}
 }
 $('#chatForm').onsubmit=e=>{e.preventDefault();send(input.value);};
 $('#chatInput').onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send(input.value);}};
 document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{input.value=b.dataset.prompt;input.focus();});
 $('#chatStop').onclick=()=>{serial++;controller?.abort();stopVoice();if(recording)finishRecording(false);status.textContent='已停止。';};
 $('#chatClear').onclick=()=>{serial++;stopVoice();history=[];lastScene=null;log.replaceChildren();message('assistant','重新开始啦。你想先聊哪件事？');status.textContent='本页对话已清空。';};
 $('#chatPause').onclick=e=>{const paused=e.currentTarget.getAttribute('aria-pressed')!=='true';avatar.setPaused(paused);e.currentTarget.setAttribute('aria-pressed',paused);e.currentTarget.textContent=paused?'开启动作':'暂停动作';};
 function wav(chunks,rate){
  const count=chunks.reduce((n,c)=>n+c.length,0),source=new Float32Array(count);let p=0;for(const c of chunks){source.set(c,p);p+=c.length;}
  const ratio=rate/16000,size=Math.floor(count/ratio),buffer=new ArrayBuffer(44+size*2),v=new DataView(buffer);const word=(offset,s)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};
  word(0,'RIFF');v.setUint32(4,36+size*2,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,size*2,true);
  for(let i=0;i<size;i++){const start=Math.floor(i*ratio),end=Math.min(count,Math.floor((i+1)*ratio));let sample=0;for(let j=start;j<end;j++)sample+=source[j];sample/=Math.max(1,end-start);v.setInt16(44+i*2,Math.max(-1,Math.min(1,sample))*32767,true);}return buffer;
 }
 async function finishRecording(transcribe=true){
  const rec=recording;if(!rec)return;recording=null;clearTimeout(rec.timer);rec.processor.disconnect();rec.source.disconnect();rec.stream.getTracks().forEach(t=>t.stop());await rec.context.close();$('#chatRecord').classList.remove('recording');$('#chatRecord').textContent='🎙 点击说话';mode('idle','我在听，慢慢说');controls();
  if(!transcribe)return;const data=wav(rec.chunks,rec.rate);if(data.byteLength<3244){status.textContent='这段录音太短，请再说一次。';return;}
  busy=true;controls();status.textContent='正在本机识别语音…';controller=new AbortController();
  try{const r=await fetch(API+'transcribe',{method:'POST',headers:{'Content-Type':'audio/wav'},body:data,signal:controller.signal});const result=await r.json();if(!r.ok)throw Error(result.error||'语音识别失败');input.value=result.text;status.textContent=result.text?'识别完成，确认文字后点击发送。':'没有识别到语音，请重试。';}
  catch(e){status.textContent=e.name==='AbortError'?'已停止识别。':e.message;}finally{busy=false;controller=null;controls();}
 }
 $('#chatRecord').onclick=async()=>{
  if(recording){finishRecording();return;}if(!service.asr||busy)return;
  serial++;stopVoice();$('#chatRecord').disabled=true;
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});const Context=window.AudioContext||window.webkitAudioContext,context=new Context();await context.resume();const source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(4096,1,1),gain=context.createGain();gain.gain.value=0;source.connect(processor);processor.connect(gain);gain.connect(context.destination);const chunks=[];processor.onaudioprocess=e=>{if(recording)chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));};recording={stream,context,source,processor,chunks,rate:context.sampleRate,timer:setTimeout(()=>finishRecording(),20000)};$('#chatRecord').textContent='■ 说完了，识别';$('#chatRecord').classList.add('recording');status.textContent='正在听，最多20秒；说完后点击识别。';mode('listen','嗯，我在认真听');controls();}
  catch{status.textContent='未能打开麦克风，可以检查权限或直接输入文字。';controls();}
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden){serial++;stopVoice();if(recording)finishRecording(false);}});
 message('assistant','你好，我是阿德。把难开口的那件事告诉我吧。');
 fetch('/practice-scenes.json').then(r=>r.json()).then(data=>catalog=data).catch(()=>{});
 (async()=>{
  if(local){try{const r=await fetch(API+'status',{signal:AbortSignal.timeout(5000)});if(r.ok)service=await r.json();}catch{}}
  try{await window.AdeVoice.ready;service.tts=true;}catch{service.tts=false;}
  $('#chatService').dataset.ready=String(service.ready);
  $('#chatService').textContent=service.ready?'本地千问已连接 · '+(service.asr&&service.tts?'I声线已启用':'可连续文字对话，语音服务准备中'):'I清脆男童声线 · 话术练习模式';
  $('#chatRecord').title=service.asr?'本地语音识别':'本地语音服务接通后开放';$('#autoSpeak').disabled=!service.tts;
  if(!service.tts){$('#autoSpeak').checked=false;$('#autoSpeak').parentElement.title='本地朗读服务接通后开放';}
  controls();
 })();
})();
