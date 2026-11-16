/* Direct browser microphone capture. No recording is stored by this page. */
(() => {
 'use strict';
 function mount({button,input,label=button,status=()=>{},onActive=()=>{},onCommit=()=>{},isBusy=()=>false}){
  let epoch=0,active=false,held=false,cancelled=false,recognition=null,started=false,prefix='',text='',y=0,pointer=null,timer=null,finishTimer=null;
  const handlers=[];
  const listen=(target,name,fn)=>{target.addEventListener(name,fn);handlers.push(()=>target.removeEventListener(name,fn));};
  function paint(message){button.classList.toggle('recording',active);button.classList.toggle('voice-cancel',cancelled);button.setAttribute('aria-pressed',String(active));label.textContent=message||(active?(cancelled?'松开取消':'松开转文字 · 上滑取消'):'按住说话');}
  function clean(){clearTimeout(timer);clearTimeout(finishTimer);timer=finishTimer=null;}
  function idle(){clean();active=false;held=false;input.readOnly=false;onActive(false);paint();}
  function cancel(notice='录音已取消，原有文字已保留。'){
   if(!active)return;epoch++;const old=recognition;recognition=null;cancelled=true;try{old?.abort();}catch{}input.value=prefix;idle();status(notice);
  }
  async function start(){
   if(active||button.disabled||isBusy())return;
   const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(window.isSecureContext===false||!navigator.mediaDevices?.getUserMedia){status('请通过 HTTPS 或本机地址打开，再允许麦克风权限。');return;}
   if(!Recognition){status('此浏览器暂不支持语音转文字，请用支持的系统浏览器打开，或直接打字。');return;}
   const ticket=++epoch;active=true;held=true;cancelled=false;started=false;text='';prefix=input.value;input.readOnly=true;onActive(true);paint('正在申请麦克风权限…');status('请允许使用麦克风；按住说话，松开转文字，上滑取消。');
   try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    // Release the permission probe; SpeechRecognition owns its own microphone session.
    stream.getTracks().forEach(track=>track.stop());
    if(ticket!==epoch||!held)return;
    const rec=new Recognition();recognition=rec;rec.lang='zh-CN';rec.continuous=true;rec.interimResults=true;
    rec.onstart=()=>{if(ticket!==epoch||!held){try{rec.abort();}catch{}return;}started=true;paint();status('正在听…松开转文字，上滑取消。');};
    rec.onresult=event=>{if(ticket!==epoch)return;text=Array.from(event.results).map(result=>result[0]?.transcript||'').join('');status(cancelled?'松开手指，取消这次录音。':text||'正在听…');};
    rec.onerror=event=>{if(ticket!==epoch)return;cancel(event.error==='not-allowed'||event.error==='service-not-allowed'?'麦克风或语音识别权限未开启，请在浏览器设置中允许后重试。':event.error==='no-speech'?'没有听清，请重新按住说话。':'语音识别暂不可用，原有文字已保留，请重试或打字。');};
    rec.onend=()=>{if(ticket!==epoch)return;recognition=null;epoch++;input.value=prefix+(text.trim()?(prefix.trim()?'\n':'')+text.trim():'');idle();status(text.trim()?'已转成草稿，请校对后再发送。':'没有识别到内容，原有文字已保留。');if(text.trim())onCommit(text.trim());};
    rec.start();timer=setTimeout(finish,30000);
   }catch(error){if(ticket===epoch)cancel(error.name==='NotAllowedError'?'麦克风权限未开启，请在浏览器中允许后重试。':error.name==='NotFoundError'?'没有找到可用麦克风，可以先打字。':'麦克风暂时无法使用，请重试或打字。');}
  }
  function finish(){
   if(!active)return;if(cancelled){cancel();return;}held=false;
   if(!recognition||!started){cancel('按住时间较短或权限尚未确认，请允许麦克风后重新按住说话。');return;}
   clearTimeout(timer);paint('正在转文字…');status('正在整理语音文字…');
   // Timeout also aborts the recognizer, so it cannot keep the microphone open.
   finishTimer=setTimeout(()=>cancel('识别等待超时，原有文字已保留，请重试。'),10000);
   try{recognition.stop();}catch{cancel('录音已结束，请重新按住说话。');}
  }
  listen(button,'pointerdown',e=>{if(e.isPrimary===false||(e.button!==undefined&&e.button!==0))return;e.preventDefault();pointer=e.pointerId;y=e.clientY;try{button.setPointerCapture(pointer);}catch{}start();});
  listen(button,'pointermove',e=>{if(active&&held&&e.pointerId===pointer){cancelled=y-e.clientY>60;paint();}});
  listen(button,'pointerup',e=>{if(e.pointerId===pointer){pointer=null;finish();}});
  listen(button,'pointercancel',()=>cancel());
  listen(button,'lostpointercapture',()=>{if(held)cancel();});
  listen(button,'contextmenu',e=>e.preventDefault());
  listen(button,'keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();start();}});
  listen(button,'keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();finish();}});
  listen(button,'click',e=>{if(e.detail===0){if(active)finish();else start();}});
  const hidden=()=>{if(document.hidden)cancel();};listen(document,'visibilitychange',hidden);listen(window,'pagehide',()=>cancel());
  button.setAttribute('aria-label','按住说话，松开转文字，上滑取消');paint();
  return {start,finish,cancel,destroy(){cancel();handlers.forEach(off=>off());}};
 }
 window.AdeHoldToTalk={mount};
})();
