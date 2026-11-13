/* Loopback-only companion gateway. No cloud inference, credentials or paid APIs. */
const http=require('node:http'),fs=require('node:fs'),fsp=fs.promises,path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),{Readable}=require('node:stream');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'public');
const runtime=process.env.DETI_AI_RUNTIME||path.resolve(root,'../../本地AI运行环境');
const PORT=Number(process.env.DETI_AI_PORT)||4180,modelPort=Number(process.env.DETI_MODEL_PORT)||11490;
const system='你是得体说的陪伴伙伴小得。用简体中文回答，先理解用户处境，再给一句可以直接说出口的沟通话术，必要时问一个简短问题。每次不超过150字。不要声称自己是真人，不编造经历，不索取隐私，不冒充专业医生或律师。请记住对话里已经提供的情况，支持追问。';
const find=(dir,name)=>{if(!fs.existsSync(dir))return null;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isFile()&&e.name.toLowerCase()===name)return p;if(e.isDirectory()){const hit=find(p,name);if(hit)return hit;}}return null;};
const whisper=find(path.join(runtime,'whisper'),'whisper-cli.exe'),asrModel=path.join(runtime,'models','ggml-tiny.bin');
const powershell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
function validatedMessages(value){if(!Array.isArray(value)||!value.length||value.length>12)throw Error('请发送1至12条对话');return value.map(m=>{if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>800)throw Error('对话格式不正确');return {role:m.role,content:m.content.trim()};});}
async function body(req,max){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max){const e=Error('内容过长');e.status=413;throw e;}chunks.push(c);}return Buffer.concat(chunks);}
function run(binary,args,stdin='',timeout=45000){return new Promise((resolve,reject)=>{const child=spawn(binary,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let error='';const timer=setTimeout(()=>{child.kill();reject(Error('本机语音处理超时，请缩短内容后重试'));},timeout);child.stdout.resume();child.stderr.on('data',c=>{error+=c.toString();});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('本机语音处理未完成'));});child.stdin.on('error',()=>{});child.stdin.end(stdin);});}
async function health(){try{const r=await fetch('http://127.0.0.1:'+modelPort+'/health',{signal:AbortSignal.timeout(1500)});return r.ok;}catch{return false;}}
let work=false;
async function handle(req,res){
 const url=new URL(req.url,'http://127.0.0.1:'+PORT);
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(!['127.0.0.1:'+PORT,'localhost:'+PORT].includes(req.headers.host)){json(res,403,{error:'仅允许本机访问'});return;}
 if(req.headers.origin&&!['http://127.0.0.1:'+PORT,'http://localhost:'+PORT].includes(req.headers.origin)){json(res,403,{error:'请从本机对话页面使用服务'});return;}
 try{
  if(url.pathname==='/companion-api/status'&&req.method==='GET'){json(res,200,{ready:await health(),asr:!!whisper&&fs.existsSync(asrModel),tts:fs.existsSync(path.join(assets,'voice-i/manifest.json')),voice:'I',voice_id:'M09',model:'Qwen3-0.6B-Q8_0',localOnly:true});return;}
  if(url.pathname.startsWith('/companion-api/')){
   if(req.method!=='POST'){json(res,405,{error:'请使用POST'});return;}
   if(work){json(res,429,{error:'小得正在处理上一段内容，请稍后再试'});return;}
   work=true;
   try{
    if(url.pathname==='/companion-api/chat'){
     if(!req.headers['content-type']?.includes('application/json')){json(res,415,{error:'需要JSON格式'});return;}
     const payload=JSON.parse((await body(req,24000)).toString('utf8')),messages=validatedMessages(payload.messages);if(messages.at(-1).role!=='user')throw Error('最后一条应为你的问题');
     const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
     const upstream=await fetch('http://127.0.0.1:'+modelPort+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:system},...messages],stream:true,max_tokens:256,temperature:.6,chat_template_kwargs:{enable_thinking:false}}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(90000)])});
     if(!upstream.ok){json(res,503,{error:'本地千问未准备好，请检查模型服务'});return;}
     res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive'});
     for await(const chunk of Readable.fromWeb(upstream.body)){if(res.destroyed)break;res.write(chunk);}res.end();return;
    }
    const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'deti-voice-'));
    try{
     if(url.pathname==='/companion-api/speak'){
      const {text}=JSON.parse((await body(req,6000)).toString('utf8'));if(typeof text!=='string'||!text.trim()||text.length>500)throw Error('朗读内容应为1至500字');
      const normalize=value=>value.replace(/\s+/g,'').replace(/[“”]/g,'"');
      const manifest=JSON.parse(await fsp.readFile(path.join(assets,'voice-i/manifest.json'),'utf8'));
      if(manifest.voice!=='I'||manifest.voice_id!=='M09')throw Error('I声线配置不正确');
      const clips=manifest.clips.map(clip=>({...clip,key:normalize(clip.text)})).sort((a,b)=>b.key.length-a.key.length);
      let remaining=normalize(text);const chunks=[];
      while(remaining){const clip=clips.find(c=>remaining.startsWith(c.key));if(!clip){json(res,503,{error:'这条回答的I声线尚未生成，文字已保留'});return;}const audioPath=path.resolve(assets,'.'+clip.src);if(!audioPath.startsWith(path.join(assets,'voice-i')+path.sep))throw Error('声音文件路径不正确');const wav=await fsp.readFile(audioPath);if(wav.toString('ascii',0,4)!=='RIFF'||wav.readUInt32LE(24)!==24000||wav.toString('ascii',36,40)!=='data')throw Error('I音频格式异常');chunks.push(wav.subarray(44));remaining=remaining.slice(clip.key.length);}
      const pcm=Buffer.concat(chunks),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
      res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Ade-Voice':'I-M09'});res.end(Buffer.concat([header,pcm]));return;
     }
     if(url.pathname==='/companion-api/transcribe'){
      if(!whisper||!fs.existsSync(asrModel)){json(res,503,{error:'本地语音识别模型尚未准备好'});return;}
      const audio=await body(req,700000);if(audio.length<44||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE'||audio.readUInt32LE(24)!==16000||audio.readUInt16LE(22)!==1||audio.readUInt16LE(34)!==16)throw Error('请提供16kHz单声道PCM录音');
      const file=path.join(temp,'input.wav'),out=path.join(temp,'result');await fsp.writeFile(file,audio);await run(whisper,['-m',asrModel,'-f',file,'-l','zh','-t','6','-nt','-otxt','-of',out]);const text=(await fsp.readFile(out+'.txt','utf8')).trim();json(res,200,{text});return;
     }
     json(res,404,{error:'没有这个接口'});return;
    }finally{if(!path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'deti-voice-'))throw Error('临时文件目录异常');await fsp.rm(temp,{recursive:true,force:true});}
   }finally{work=false;}
  }
  if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'不支持此操作'});return;}
  const file=url.pathname==='/'?path.join(root,'web/index.html'):path.resolve(assets,'.'+decodeURIComponent(url.pathname));
  if(file!==path.join(root,'web/index.html')&&!file.toLowerCase().startsWith((assets+path.sep).toLowerCase())){json(res,403,{error:'不允许访问此路径'});return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){json(res,404,{error:'页面不存在'});return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:await fsp.readFile(file));
 }catch(e){if(!res.headersSent)json(res,e.status||400,{error:e.name==='AbortError'?'已停止处理':e.message==='fetch failed'?'本地模型未运行，请启动本地AI服务':e instanceof SyntaxError?'内容格式不正确':e.message});else res.end();}
}
if(require.main===module)http.createServer(handle).listen(PORT,'127.0.0.1',()=>console.log('Local companion: http://127.0.0.1:'+PORT+'/chat.html (loopback only)'));
module.exports={validatedMessages,handle};
