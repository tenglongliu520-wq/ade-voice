"""Combine the user's seven Y and three N choices without resynthesis; use display codes 01-10 and retain provenance."""
import hashlib, html, json, shutil, zipfile
from pathlib import Path
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parent
out = root / 'selected10'
(out / 'audio').mkdir(parents=True, exist_ok=True)
groups = [('20261118-under20', ['Y02', 'Y04', 'Y05', 'Y06', 'Y07', 'Y08', 'Y09']),
          ('20261116-young-men', ['N02', 'N05', 'N10'])]
voices, pieces, cards = [], [], []
rate = None
for batch, ids in groups:
    source_root = root.parent / batch
    manifest = json.loads((source_root / 'manifest.json').read_text(encoding='utf-8'))
    for voice_id in ids:
        record = next(v for v in manifest['voices'] if v['id'] == voice_id)
        source = source_root / record['file']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == record['sha256']
        display_id = f'{len(voices)+1:02d}'
        target = out / 'audio' / (display_id + '.wav')
        shutil.copyfile(source, target)
        samples, sr = sf.read(target, dtype='int16')
        assert samples.ndim == 1 and rate in (None, sr)
        rate = sr
        pieces.extend([samples, np.zeros(sr, dtype='int16')])
        voices.append({**record, 'id': display_id, 'source_id': voice_id, 'source_batch': batch, 'source_file': record['file'], 'file': 'audio/' + target.name, 'user_shortlisted': True})
        cards.append('<article><h2>' + display_id + '</h2><audio aria-label="声线' + display_id + '" controls preload="none" src="audio/' + target.name + '"></audio></article>')
assert len(voices) == 10 and len({v['id'] for v in voices}) == 10
sf.write(out / 'selected10-comparison.wav', np.concatenate(pieces[:-1]), rate, subtype='PCM_16')
report = {'status': 'user_shortlisted_not_production_selected', 'selection_date': '2026-11-18', 'production_voice_changed': False, 'age_note': '7个少年Y声线与3个青年N声线的混合组，不再全部低于20岁；年龄仅为听感设计目标。', 'voices': voices}
(out / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
order = ' → '.join(v['id'] for v in voices)
page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>阿德 · 保留的10个男性声线</title><style>body{font:17px/1.7 system-ui;max-width:960px;margin:32px auto;padding:0 20px;background:#f4f5ee;color:#234b3d}article,section{background:white;border-radius:18px;padding:20px;margin:16px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}audio{width:100%}</style><h1>阿德 · 已保留的10个男性声线</h1><p>10个声音按01–10编号，可连续对比或逐段试听。</p><section><h2>连续对比</h2><p>ORDER</p><audio controls preload="none" src="selected10-comparison.wav"></audio><p>每段间隔1秒。</p></section><div class="grid">CARDS</div><script>document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()})));</script></html>'''
(out / 'index.html').write_text(page.replace('ORDER', order).replace('CARDS', ''.join(cards)), encoding='utf-8')
(out / 'README.md').write_text('# 已保留的10个男性声线\n\n顺序：'+order+'。\n\n打开 index.html 逐段试听，或播放 selected10-comparison.wav。页面只显示01–10。原编号、声音特征和年龄设计目标仅保留在manifest.json中用于来源追溯；音频内容未改变。用户已保留候选，但尚未选定最终主声，正式I/M09不变。\n', encoding='utf-8')
archive = out / 'Ade-selected-10-voices-20261118.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['index.html', 'manifest.json', 'README.md', 'selected10-comparison.wav']:
        z.write(out / name, name)
    for voice in voices:
        z.write(out / voice['file'], voice['file'])
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print('PASS: ten selected voices copied unchanged, display codes 01-10 with source IDs retained internally, offline ZIP verified.')
print('Order: ' + order)
print('Duration: ' + str(round(sum(len(p) for p in pieces[:-1])/rate, 2)) + ' seconds')
