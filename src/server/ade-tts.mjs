const buckets=new Map();
const reply=(detail,status)=>Response.json({detail},{status,headers:{'Cache-Control':'no-store'}});
// The upstream must serve the selected 05/Y07 clone, never a device/default voice.
export async function handleTts(request,config={},fetcher=fetch){
 const url=new URL(request.url);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return reply('请从得体说页面播放声音',403);
 if(request.method==='GET')return Response.json({ready:!!(config.url&&config.token),voice:'05',voice_id:'Y07'},{headers:{'Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply('请求方法不支持',405);
 let text;
 try{const raw=await request.text();if(raw.length>6000)throw Error();text=JSON.parse(raw).text;if(typeof text!=='string'||!text.trim()||text.length>1600)throw Error();}catch{return reply('朗读内容应为1至1600字',400);}
 const ip=request.headers.get('cf-connecting-ip');
 if(ip){const now=Date.now();for(const [key,value] of buckets)if(now-value.start>60000)buckets.delete(key);let bucket=buckets.get(ip);if(!bucket){bucket={start:now,count:0};buckets.set(ip,bucket);}if(++bucket.count>60)return reply('朗读请求太频繁，请稍后重试。',429);}
 if(!config.url||!config.token)return reply('阿德实时语音服务尚未连接，文字已保留；连接后可点击重听。',503);
 try{
  const target=new URL(config.url);if(target.protocol!=='https:')return reply('语音服务配置不正确',503);
  const upstream=await fetcher(target.href,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify({text:text.trim(),voice:'05',voice_id:'Y07'}),signal:AbortSignal.any([request.signal,AbortSignal.timeout(180000)]),redirect:'manual'});
  if(!upstream.ok)return reply('阿德语音服务暂时繁忙，请稍后点击重听。',503);
  if(upstream.headers.get('X-Ade-Voice')!=='05-Y07'||!upstream.headers.get('Content-Type')?.startsWith('audio/'))return reply('语音服务返回的声线或音频格式不正确',502);
  return new Response(upstream.body,{headers:{'Content-Type':upstream.headers.get('Content-Type'),'Cache-Control':'no-store','X-Ade-Voice':'05-Y07','X-Content-Type-Options':'nosniff'}});
 }catch{return reply('阿德语音连接超时或中断，请点击重听。',504);}
}
