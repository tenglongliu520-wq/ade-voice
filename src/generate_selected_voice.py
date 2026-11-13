"""Generate only the active site's existing speech in selected synthetic voice I/M09.
No text, timing/UX, character animation or device voice substitutions.
"""
import argparse, hashlib, json, os, random, time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,required=True);p.add_argument('--worker',type=int,default=0);p.add_argument('--workers',type=int,default=1);p.add_argument('--model',default='D:/AI/Ade-voice-design-20261105/models/Qwen3-TTS-12Hz-0.6B-Base');args=p.parse_args()
os.environ['HF_HUB_OFFLINE']='1';os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
root=args.workspace/'本地AI运行环境/阿德多年龄男声';out=root/'I统一声音';out.mkdir(exist_ok=True)
source=json.loads((args.workspace/'sites/detishuo-home/public/voice-e/manifest.json').read_text(encoding='utf-8'))
ref=root/'试听音频/M09.wav';refhash=hashlib.sha256(ref.read_bytes()).hexdigest()
anchor=json.loads((root/'声音角色清单.json').read_text(encoding='utf-8'))['text']
old=json.loads((root/'四场景试听/生成进度.json').read_text(encoding='utf-8'))['completed'].values()
reuse={r['text']:r for r in old if r['label']=='I' and r['voice_id']=='M09'}
progress=out/('进度'+str(args.worker)+'.json')
completed=json.loads(progress.read_text(encoding='utf-8'))['completed'] if progress.exists() else {}
def save(current=None):
 temp=progress.with_suffix('.tmp');temp.write_text(json.dumps({'voice':'I','voice_id':'M09','reference_sha256':refhash,'completed':completed,'current':current},ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(progress)
model=None
import numpy as np,soundfile as sf
for index,job in enumerate(source['clips']):
 if index%args.workers!=args.worker:continue
 key=hashlib.sha256(job['text'].encode()).hexdigest()[:20];target=out/(key+'.wav')
 if target.exists() and completed.get(key,{}).get('sha256')==hashlib.sha256(target.read_bytes()).hexdigest():continue
 start=time.perf_counter();save(key);print('START '+str(index+1)+'/'+str(len(source['clips'])),flush=True)
 if job['text'] in reuse:
  audio,sr=sf.read(root/'四场景试听/原始音频'/reuse[job['text']]['file'],dtype='float32')
 else:
  if model is None:
   import torch
   from qwen_tts import Qwen3TTSModel
   torch.set_num_threads(3);torch.set_num_interop_threads(1)
   model=Qwen3TTSModel.from_pretrained(args.model,device_map='cpu',dtype=torch.float32,attn_implementation='sdpa')
   prompt=model.create_voice_clone_prompt(ref_audio=str(ref),ref_text=anchor)
  seed=int(key[:6],16);random.seed(seed);np.random.seed(seed);torch.manual_seed(seed)
  with torch.inference_mode():waves,sr=model.generate_voice_clone(text=job['text'],language='Chinese',voice_clone_prompt=prompt,max_new_tokens=1536,top_p=.9,temperature=.8)
  audio=np.asarray(waves[0],dtype=np.float32).reshape(-1)
 duration=len(audio)/sr
 assert .5<duration<119 and np.isfinite(audio).all() and np.sqrt(np.mean(audio*audio))>.001
 gain=min(.1/float(np.sqrt(np.mean(audio*audio))),.95/max(float(abs(audio).max()),1e-6));audio*=gain
 tmp=target.with_suffix('.partial.wav');sf.write(tmp,audio,sr,subtype='PCM_16');tmp.replace(target)
 completed[key]={'text':job['text'],'src':'/voice-i/'+target.name,'duration':round(duration,3),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'reference_sha256':refhash};save()
 print('DONE '+str(index+1)+' seconds='+str(round(time.perf_counter()-start,1)),flush=True)
print('COMPLETE',flush=True)
