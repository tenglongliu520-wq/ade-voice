"""Ten independently designed synthetic young adult male auditions; not a production switch."""
import argparse, hashlib, json, os, random, time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--model', default='D:/AI/Ade-voice-design-20261105/models/Qwen3-TTS-12Hz-1.7B-VoiceDesign')
parser.add_argument('--worker', type=int, default=0)
parser.add_argument('--workers', type=int, default=1)
parser.add_argument('--threads', type=int, default=4)
args = parser.parse_args()
assert 0 <= args.worker < args.workers
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

root = Path(__file__).resolve().parent
out = root / 'raw'
out.mkdir(exist_ok=True)
catalog = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
progress = root / f'progress-{args.worker}.json'
completed = json.loads(progress.read_text(encoding='utf-8')) if progress.exists() else {}
torch.set_num_threads(args.threads)
torch.set_num_interop_threads(1)
model = None
for index, voice in enumerate(catalog['voices']):
    if index % args.workers != args.worker:
        continue
    target = out / (voice['id'] + '.wav')
    fingerprint = hashlib.sha256(json.dumps({'voice': voice, 'text': catalog['text'], 'engine': catalog['engine']}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    if target.exists() and completed.get(voice['id'], {}).get('fingerprint') == fingerprint and completed[voice['id']]['sha256'] == hashlib.sha256(target.read_bytes()).hexdigest():
        continue
    if model is None:
        print('Loading VoiceDesign on CPU', flush=True)
        model = Qwen3TTSModel.from_pretrained(args.model, device_map='cpu', dtype=torch.float32, attn_implementation='sdpa')
    print('START ' + voice['id'], flush=True)
    started = time.perf_counter()
    random.seed(voice['seed'])
    np.random.seed(voice['seed'])
    torch.manual_seed(voice['seed'])
    with torch.inference_mode():
        waves, sr = model.generate_voice_design(text=catalog['text'], language='Chinese', instruct=voice['instruct'], max_new_tokens=384, do_sample=True, top_p=.95, temperature=.9)
    samples = np.asarray(waves[0], dtype=np.float32).reshape(-1)
    duration = len(samples) / sr
    if not np.isfinite(samples).all() or not 3 < duration < 30 or np.sqrt(np.mean(samples * samples)) < .001:
        raise RuntimeError('Audio validation failed: ' + voice['id'])
    temp = target.with_suffix('.partial.wav')
    sf.write(temp, samples, sr, subtype='PCM_16')
    temp.replace(target)
    completed[voice['id']] = {**voice, 'text': catalog['text'], 'file': 'raw/' + target.name, 'sample_rate': sr, 'duration': round(duration, 3), 'generation_seconds': round(time.perf_counter() - started, 2), 'fingerprint': fingerprint, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'listening_approved': False}
    temp = progress.with_suffix('.tmp')
    temp.write_text(json.dumps(completed, ensure_ascii=False, indent=2), encoding='utf-8')
    temp.replace(progress)
    print('DONE ' + voice['id'] + ' ' + str(completed[voice['id']]['generation_seconds']) + 's', flush=True)
print('Worker complete', flush=True)
