(() => {
 const home=document.querySelector('#welcomeView');if(!home)return;
 const promise=document.createElement('section');promise.className='home-promise';promise.innerHTML='<h1>难开口的话<br>阿德陪你说</h1><p>把遇到的事告诉阿德，一起找到合适的回应。</p>';home.prepend(promise);
 const oldHeading=home.querySelector(':scope > h1');if(oldHeading)oldHeading.remove();
 home.querySelector('.welcome-character p').textContent='阿德';
 // The home has one input area: the AI conversation.
 for(const id of ['welcomeSearch','welcomeMic','welcomeVoiceStatus','welcomeReply'])home.querySelector('#'+id)?.remove();
 const actions=document.createElement('nav');actions.className='home-actions';actions.setAttribute('aria-label','阿德陪伴入口');actions.innerHTML='<a href="/chat.html">和阿德聊聊 ↗</a><a href="/sounds.html">听听阿德的声音 ♫</a>';
 const board=document.createElement('section');board.className='home-board';board.innerHTML='<h2>这些话，陪你一起说</h2><p>9个常见场景 · 点开就有一句合适的回应</p><div class="home-scene-grid"></div><a class="home-all" href="#">查看全部81个场景 →</a>';
 const scenes=[['🛡','道德绑架','道德绑架'],['💬','被父母催婚','被父母催婚'],['🏠','第一次见家长','第一次见双方家长'],['🎁','彩礼婚礼开支','谈彩礼嫁妆与婚礼开支'],['🌿','婆媳矛盾','婆媳矛盾'],['🍵','饭局酒桌','饭局酒桌'],['⏳','跨部门催进度','跨部门催进度'],['📊','绩效沟通','绩效被打低分'],['🤝','拒绝借钱','借钱不想借']];
 for(const [icon,label,query] of scenes){const b=document.createElement('button');b.type='button';const i=window.AdeExpressions.image(window.AdeExpressions.choose(label),'home-scene-expression');const s=document.createElement('strong');s.textContent=label;b.append(i,s);b.onclick=()=>{const group=FEATURED_LIBRARY.find(g=>g.title.includes(query));const row=group?findScene(group.rows[0].id):query==='借钱不想借'?DATA.find(r=>r.short.includes('借大钱')):null;if(row){openDetail(row);return;}document.querySelector('#bottomNav button[data-tab="2"]').click();const field=document.querySelector('#search');field.value=query;field.dispatchEvent(new Event('input',{bubbles:true}));};board.querySelector('.home-scene-grid').append(b);}
 board.querySelector('.home-all').onclick=e=>{e.preventDefault();document.querySelector('#bottomNav button[data-tab="2"]').click();document.querySelector('#all')?.click();};
 const chat=document.createElement('section');chat.className='home-smart-chat';chat.setAttribute('aria-label','和阿德智能对话');
 const chatLink=new URL('/ade-chat.html?embed=1',location.href).href;
 chat.innerHTML='<div class="home-chat-heading"><h2>和阿德聊聊</h2><a target="_blank" rel="noopener noreferrer">单独打开</a></div><p>打字或按住说话，检查文字后点击发送。</p><div class="home-chat-stage"><div class="home-chat-connection" role="status"><img src="/expressions/nod.webp" alt=""><strong>正在连接阿德…</strong><p>正在打开对话框，请稍等。</p><button type="button" class="home-chat-retry" hidden>重新连接</button><a href="/chat.html">先使用话术练习</a></div><iframe title="和阿德智能对话" referrerpolicy="no-referrer" loading="eager" allow="microphone; autoplay" hidden></iframe></div><p class="home-chat-note">可以继续追问，也可以请阿德说得更简短、更委婉。声音未播放时，点击回答下方的重听。</p>';
 chat.querySelector('a').href=chatLink.replace('?embed=1','');chat.querySelector('iframe').src=chatLink;
 const puppetActions=home.querySelector('.mascot-actions');
 if(puppetActions){const details=document.createElement('details');details.className='home-avatar-actions';const summary=document.createElement('summary');summary.textContent='小动作';puppetActions.before(details);details.append(summary,puppetActions);}
 const intro=document.createElement('section');intro.className='home-intro';intro.setAttribute('aria-label','阿德陪你说');intro.append(promise,home.querySelector('.welcome-character'));home.prepend(intro);intro.after(chat);
 chat.id='adeHomeChat';board.id='homeSceneShortcuts';actions.querySelector('a').href='#homeSceneShortcuts';actions.querySelector('a').textContent='查看场景话术';
 home.append(actions,board);
 const guide=document.querySelector('#guideDialog');
 if(guide){guide.querySelector('h2').textContent='先和阿德聊聊';const steps=guide.querySelectorAll('.guide-step');
 const guideText=[['把情况告诉阿德','在首页对话框打字，或按住说话；松开转文字，上滑可取消。'],['检查文字，再发送','语音不会自动发送。修改好草稿后点击发送，可以继续追问。'],['想找现成话术？','往下查看场景快捷入口，或到“场景交流”查看全部话术。']];
 steps.forEach((step,index)=>{if(guideText[index]){step.querySelector('strong').textContent=guideText[index][0];step.querySelector('span').textContent=guideText[index][1];}});
 const begin=guide.querySelector('#closeGuide');begin.textContent='开始和阿德聊';begin.addEventListener('click',()=>{chat.scrollIntoView({block:'start',behavior:'auto'});chat.querySelector('iframe').contentDocument?.querySelector('#input')?.focus({preventScroll:true});});}
 const navFaces=['smile','ready','letter','heart'];document.querySelectorAll('#bottomNav button').forEach((button,index)=>{const old=button.querySelector('.nav-icon');const face=window.AdeExpressions.image(navFaces[index]||'smile','nav-expression');if(old)old.replaceWith(face);else button.prepend(face);});
 const chatFrame=chat.querySelector('iframe'),chatOrigin=new URL(chatLink).origin;
 const connection=chat.querySelector('.home-chat-connection'),retry=chat.querySelector('.home-chat-retry');let connectTimer;
 function disconnected(){home.querySelector('.welcome-character')?.adeAvatar?.setState('idle');chatFrame.hidden=true;connection.hidden=false;connection.querySelector('strong').textContent='阿德暂时未能连接';connection.querySelector('p').textContent='网络暂未连接，请重试，或先使用话术练习。';retry.hidden=false;}
 function waitForConnection(){clearTimeout(connectTimer);chatFrame.hidden=true;connection.hidden=false;retry.hidden=true;connection.querySelector('strong').textContent='正在连接阿德…';connection.querySelector('p').textContent='正在打开对话框，请稍等。';connectTimer=setTimeout(disconnected,6000);}
 retry.onclick=()=>{waitForConnection();chatFrame.src=chatLink;};
 window.addEventListener('message',event=>{if(event.origin!==chatOrigin||event.source!==chatFrame.contentWindow)return;if(event.data?.type==='ade-avatar-motion'){const avatar=home.querySelector('.welcome-character')?.adeAvatar;if(avatar){avatar.setState(event.data.mode);avatar.setSpeechLevel(event.data.level);}return;}if(event.data?.type==='ade-frame-loaded'){chatFrame.contentWindow?.postMessage({type:'ade-avatar-connect'},chatOrigin);clearTimeout(connectTimer);connection.hidden=true;chatFrame.hidden=false;}if(event.data?.type==='ade-frame-error'){clearTimeout(connectTimer);disconnected();}});
 chatFrame.addEventListener('load',()=>{chatFrame.contentWindow?.postMessage({type:'ade-avatar-connect'},chatOrigin);clearTimeout(connectTimer);connection.hidden=true;chatFrame.hidden=false;});
 chatFrame.addEventListener('error',()=>{clearTimeout(connectTimer);disconnected();});waitForConnection();
 const observer=new MutationObserver(()=>{if(home.hidden)chatFrame.contentWindow?.postMessage({type:'ade-pause'},chatOrigin);});observer.observe(home,{attributes:true,attributeFilter:['hidden']});
})();
