"""Install fully generated I/M09 library without changing character or page layout."""
import hashlib,json,shutil,wave
from pathlib import Path
import argparse
p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,required=True);a=p.parse_args()
w=a.workspace;root=w/'本地AI运行环境/阿德多年龄男声';source=root/'I统一声音';site=w/'sites/detishuo-home'
old=json.loads((site/'public/voice-e/manifest.json').read_text(encoding='utf-8'));done={}
for f in source.glob('进度*.json'):done.update(json.loads(f.read_text(encoding='utf-8'))['completed'])
clips=[]
for oldclip in old['clips']:
 key=hashlib.sha256(oldclip['text'].encode()).hexdigest()[:20];r=done[key];f=source/(key+'.wav')
 assert hashlib.sha256(f.read_bytes()).hexdigest()==r['sha256']
 with wave.open(str(f)) as audio:assert (audio.getframerate(),audio.getnchannels(),audio.getsampwidth())==(24000,1,2)
 clips.append({k:r[k] for k in ['text','src','duration','sha256']})
ref=root/'试听音频/M09.wav';refhash=hashlib.sha256(ref.read_bytes()).hexdigest()
assert all(r['reference_sha256']==refhash for r in done.values())
manifest={'voice':'I','voice_id':'M09','name':'清脆男童','age_target':'6–10岁','reference_sha256':refhash,'engine':'Qwen3-TTS-12Hz-0.6B-Base','clips':clips,'completed':len(clips),'planned':len(clips)}
out=site/'public/voice-i';out.mkdir(exist_ok=True)
for r in clips:shutil.copy2(source/Path(r['src']).name,out/Path(r['src']).name)
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
moods=json.loads((site/'public/sounds/manifest.json').read_text(encoding='utf-8'))
for item in moods:
 clip=next(c for c in clips if c['text']==item['description']);item.update(src=clip['src'],voice='I',voice_id='M09')
(site/'public/sounds/manifest.json').write_text(json.dumps(moods,ensure_ascii=False,indent=2),encoding='utf-8')
def edit(f,fn):
 text=f.read_text(encoding='utf-8-sig');f.write_text(fn(text),encoding='utf-8')
def voice(s):return s.replace('voice-e','voice-i').replace("'M01'","'M09'").replace("'E'","'I'").replace('E-M01','I-M09').replace('E声线','I声线').replace('E声音','I声音').replace('E语音','I语音').replace('E音频','I音频').replace('E清朗少年','I清脆男童').replace('character E / M01','character I / M09')
for name in ['public/ade-voice.js','public/sounds.js','public/sounds.html','public/companion-chat.js','local-ai/server.cjs']:
 edit(site/name,voice)
# Cache updates affect only voice scripts; character and style versions are preserved.
for name in ['public/chat.html','public/sounds.html']:
 import re
 edit(site/name,lambda s:re.sub(r'((?:ade-voice|sounds|companion-chat)\.js)\?v=[^"\s]+',r'\1?v=20261113-i',s))
for name in ['tests/e-voice.cjs','tests/companion.cjs']:
 edit(site/name,lambda s:voice(s).replace('completed E clips','completed I clips').replace('eight E character','eight I character').replace('uses E and','uses I and'))
# Keep the existing live gateway and its login/input/model transport intact.
for folder in [Path('D:/AI/Ade-companion-20261104/share/public'),w/'本地AI运行环境/阿德实时对话/share/public']:
 if not folder.exists():continue
 shutil.copytree(out,folder/'voice-i',dirs_exist_ok=True)
 f=folder/'app.js'
 if f.exists():edit(f,voice)
 f=folder/'index.html'
 if f.exists():
  import re
  edit(f,lambda s:re.sub(r'(/assets/app\.js)\?v=[^"\s]+',r'\1?v=20261113-i',s))
print('Installed I/M09',len(clips),'clips and',len(moods),'unchanged mood texts')
