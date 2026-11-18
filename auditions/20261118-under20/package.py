"""Validate all ten current designs, normalize listening copies, and package offline auditions."""
import hashlib, html, json, zipfile
from pathlib import Path
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parent
catalog = json.loads((root / 'catalog.json').read_text(encoding='utf-8'))
completed = {}
for file in root.glob('progress-*.json'):
    completed.update(json.loads(file.read_text(encoding='utf-8')))
out = root / 'audio'
out.mkdir(exist_ok=True)
checks, pieces, cards = [], [], []
rate = None
for voice in catalog['voices']:
    assert all(15 <= int(age) < 20 for age in voice['age_target'].split('–'))
    record = completed[voice['id']]
    expected = hashlib.sha256(json.dumps({'voice': voice, 'text': catalog['text'], 'engine': catalog['engine']}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    assert record['fingerprint'] == expected
    source = root / record['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == record['sha256']
    samples, sr = sf.read(source, dtype='float32')
    assert samples.ndim == 1 and np.isfinite(samples).all() and 3 < len(samples)/sr < 30
    assert rate in (None, sr)
    rate = sr
    rms = float(np.sqrt(np.mean(samples*samples)))
    assert rms > .001
    # Same RMS target, peak limited; no pitch shifting, compression or added music.
    gain = min(.1/rms, .95/max(float(np.max(np.abs(samples))), 1e-6))
    samples *= gain
    destination = out / (voice['id'] + '.wav')
    sf.write(destination, samples, sr, subtype='PCM_16')
    pieces.extend([samples, np.zeros(sr, dtype='float32')])
    checks.append({**voice, 'file': 'audio/' + destination.name, 'raw_sha256': record['sha256'], 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'duration': record['duration'], 'gain': round(gain, 6), 'sample_rate': sr, 'generation_seconds': record['generation_seconds'], 'listening_approved': False})
    cards.append(f'<article><h2>{voice["id"]}</h2><p class="identity" hidden>{html.escape(voice["name"])} · 目标 {voice["age_target"]} 岁</p><audio controls preload="none" src="audio/{voice["id"]}.wav"></audio></article>')
assert len(checks) == 10 and len({r['raw_sha256'] for r in checks}) == 10
sf.write(root / 'Y01-Y10-comparison.wav', np.concatenate(pieces[:-1]), rate, subtype='PCM_16')
report = {'engine': catalog['engine'], 'text': catalog['text'], 'technical_checks_passed': True, 'human_listening_approved': False, 'age_is_design_target': True, 'pitch_shift_used': False, 'normalization': 'same RMS target with peak limit; not perceptual loudness certification', 'voices': checks}
(root / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>阿德 · 10位少年男性声线试听</title><style>body{font:17px/1.7 system-ui;max-width:960px;margin:36px auto;padding:0 20px;background:#f4f5ee;color:#234b3d}article,.compare{padding:20px;background:white;border-radius:18px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}audio{width:100%}button{font:inherit;padding:10px 18px;border-radius:12px;border:1px solid #abc3b1;background:white;color:inherit}.note{font-size:15px;color:#52675b}[hidden]{display:none!important}</style><h1>阿德 · 10位少年男性声线</h1><p>先听 Y01–Y10，再看设计标签。重点比较磁性、亲和力、自然程度，以及是否让你想继续听。</p><p class="note">全新合成角色，年龄听感目标15–19岁。统一台词与播放响度目标，无配乐、变调或真人模仿。年龄、吸引力与人物差异均需人耳判断；当前I/M09正式声音未替换。</p><section class="compare"><h2>连续盲听 · Y01 → Y10</h2><p>TEXT</p><audio controls preload="none" src="Y01-Y10-comparison.wav"></audio><p>每段间隔1秒，顺序与下方一致。</p><button id="reveal">显示声线与年龄目标</button></section><div class="grid">CARDS</div><p class="note">听完后告诉我最喜欢的2–3个编号，再用更长台词确认稳定性。此批尚未经用户听审，不直接替换正式声音。</p><script>document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()})));let revealed=false;document.querySelector('#reveal').onclick=()=>{revealed=!revealed;document.querySelectorAll('.identity').forEach(e=>e.hidden=!revealed);document.querySelector('#reveal').textContent=revealed?'隐藏设计标签':'显示声线与年龄目标'};</script></html>'''
shortlist_files = []
if (root / 'shortlist.json').exists():
    shortlist = json.loads((root / 'shortlist.json').read_text(encoding='utf-8'))
    ids = shortlist['voice_ids']
    assert ids and len(ids) == len(set(ids)) and set(ids) <= {v['id'] for v in catalog['voices']}
    selected_pieces = []
    for voice_id in ids:
        samples, sr = sf.read(out / (voice_id + '.wav'), dtype='float32')
        assert sr == rate
        selected_pieces.extend([samples, np.zeros(sr, dtype='float32')])
        page = page.replace('<h2>' + voice_id + '</h2>', '<h2>' + voice_id + ' · 已保留</h2>')
    sf.write(root / 'Y-shortlist-comparison.wav', np.concatenate(selected_pieces[:-1]), rate, subtype='PCM_16')
    selection = ' → '.join(ids)
    section = '<section class="compare"><h2>已保留的7个候选</h2><p>' + html.escape(selection) + '</p><audio controls preload="none" src="Y-shortlist-comparison.wav"></audio><p>其他候选保留归档，当前正式I/M09声音未替换。</p></section>'
    page = page.replace('<section class="compare">', section + '<section class="compare">', 1)
    page = page.replace('此批尚未经用户听审，不直接替换正式声音。', '已记录首轮保留名单，最终主声尚未选定，不直接替换正式声音。')
    shortlist_files = ['shortlist.json', 'Y-shortlist-comparison.wav']
(root / 'index.html').write_text(page.replace('TEXT', html.escape(catalog['text'])).replace('CARDS', ''.join(cards)), encoding='utf-8')
archive = root / 'Ade-10-under20-male-voices-20261118.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['index.html', 'catalog.json', 'manifest.json', 'README.md', 'Y01-Y10-comparison.wav'] + shortlist_files:
        z.write(root / name, name)
    for file in out.glob('*.wav'):
        z.write(file, 'audio/' + file.name)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print('PASS: ten current designs, distinct raw hashes, normalized audio, comparison and offline ZIP', flush=True)
