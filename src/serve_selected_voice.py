from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, hashlib, hmac, io, json, os, threading

# Run using the existing Qwen3-TTS environment. No model or credentials in source.
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--model',required=True)
    p.add_argument('--port',type=int,default=4191)
    p.add_argument('--host',default='127.0.0.1')
    args=p.parse_args()
    token=os.environ.get('ADE_TTS_TOKEN','')
    if len(token)<24: raise SystemExit('Set ADE_TTS_TOKEN to a random secret of at least 24 characters.')
    os.environ['HF_HUB_OFFLINE']='1'
    os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
    import numpy as np, soundfile as sf, torch
    from qwen_tts import Qwen3TTSModel
    root=Path(__file__).resolve().parents[1]
    manifest=json.loads((root/'voices/selected.json').read_text(encoding='utf-8'))
    reference=root/manifest['reference']
    if hashlib.sha256(reference.read_bytes()).hexdigest()!=manifest['reference_sha256']:
        raise SystemExit('Reference hash mismatch')
    torch.set_num_threads(3)
    model=Qwen3TTSModel.from_pretrained(args.model,device_map='cpu',dtype=torch.float32,attn_implementation='sdpa')
    prompt=model.create_voice_clone_prompt(ref_audio=str(reference),ref_text=manifest['reference_text'])
    lock=threading.Lock()
    cache={}
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass  # Never log user text, headers or tokens.
        def respond(self,status,body,kind='application/json'):
            self.send_response(status);self.send_header('Content-Type',kind)
            self.send_header('Cache-Control','no-store');self.send_header('X-Ade-Voice','05-Y07')
            self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        def do_GET(self):
            self.respond(200,b'{"ready":true,"voice":"05","voice_id":"Y07"}')
        def do_POST(self):
            if self.path!='/tts': self.respond(404,b'{}');return
            if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):
                self.respond(401,b'{}');return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=24000: raise ValueError()
                payload=json.loads(self.rfile.read(size));text=payload['text']
                if payload.get('voice')!='05' or payload.get('voice_id')!='Y07' or not isinstance(text,str) or not 0<len(text.strip())<=1600: raise ValueError()
            except (ValueError,KeyError,TypeError): self.respond(400,b'{}');return
            if text.strip() in cache:self.respond(200,cache[text.strip()],'audio/wav');return
            if not lock.acquire(blocking=False):self.respond(429,b'{}');return
            try:
                with torch.inference_mode():
                    waves,rate=model.generate_voice_clone(text=text.strip(),language='Chinese',voice_clone_prompt=prompt,max_new_tokens=2048,top_p=.9,temperature=.8)
                audio=np.asarray(waves[0],dtype=np.float32).reshape(-1)
                if not len(audio) or not np.isfinite(audio).all() or np.max(np.abs(audio))<.001:raise ValueError()
                audio*=min(.1/max(float(np.sqrt(np.mean(audio*audio))),1e-6),.95/max(float(np.max(np.abs(audio))),1e-6))
                out=io.BytesIO();sf.write(out,audio,rate,format='WAV',subtype='PCM_16')
                data=out.getvalue()
                if len(cache)>=64:cache.pop(next(iter(cache)))
                cache[text.strip()]=data
                self.respond(200,data,'audio/wav')
            except (BrokenPipeError,ConnectionResetError):pass
            except Exception:self.respond(503,b'{}')
            finally:lock.release()
    print('05/Y07 synthesis ready on '+args.host+':'+str(args.port),flush=True)
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()

if __name__=='__main__': main()
