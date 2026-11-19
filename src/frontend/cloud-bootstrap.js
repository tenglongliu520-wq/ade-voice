(() => {
 window.adeReady=Promise.resolve();
 const embedded=new URLSearchParams(location.search).get('embed')==='1';
 if(embedded){document.documentElement.classList.add('ade-embedded');const css=document.createElement('link');css.rel='stylesheet';css.href='/ade-chat-assets/embed.css?v=20261119-approved';document.head.append(css);}
 const announce=()=>{if(embedded)parent.postMessage({type:'ade-frame-loaded'},location.origin);};
 window.addEventListener('DOMContentLoaded',()=>{announce();if(embedded){const connection=document.querySelector('#connection'),clear=document.querySelector('#clear');const status=()=>parent.postMessage({type:'ade-chat-status',ready:connection.classList.contains('ready'),busy:clear.disabled},location.origin);new MutationObserver(status).observe(connection,{attributes:true,childList:true,subtree:true});new MutationObserver(status).observe(clear,{attributes:true,attributeFilter:['disabled']});status();}});
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent)return;if(event.data?.type==='ade-frame-ping')announce();if(event.data?.type==='ade-clear')document.querySelector('#clear')?.click();if(event.data?.type==='ade-pause')document.querySelector('#stop')?.click();});
})();
