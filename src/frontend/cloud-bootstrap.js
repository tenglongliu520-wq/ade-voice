(() => {
 window.adeReady=Promise.resolve();
 const embedded=new URLSearchParams(location.search).get('embed')==='1';
 if(embedded){document.documentElement.classList.add('ade-embedded');const css=document.createElement('link');css.rel='stylesheet';css.href='/ade-chat-assets/embed.css?v=20261119-dialogue';document.head.append(css);}
 const announce=()=>{if(embedded)parent.postMessage({type:'ade-frame-loaded'},location.origin);};
 window.addEventListener('DOMContentLoaded',announce);
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='ade-frame-ping')announce();if(event.data?.type==='ade-pause')document.querySelector('#stop')?.click();});
})();
