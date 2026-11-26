"""Align the known Mandarin dialogue with its fitted soundtrack clips."""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
import torch
import whisper
from whisper.timing import find_alignment
from whisper.tokenizer import get_tokenizer

LINES = {
    'boss': '甲方都催三遍了材料呢',
    'hesitate': '我我在改',
    'report': '王总刚才没及时报进度正文发您了还剩两个数十分钟后我主动更新甲方来电我跟您一起接我来讲清楚',
}

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--clips', type=Path, required=True)
parser.add_argument('--model', type=Path, required=True)
parser.add_argument('--ffmpeg', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
torch.set_num_threads(6)
model = whisper.load_model(str(args.model), device='cpu')
tokenizer = get_tokenizer(model.is_multilingual, language='zh', task='transcribe')
results = {}
for name, line in LINES.items():
    path = args.clips / f'{name}-fitted.wav'
    command = [str(args.ffmpeg), '-v', 'error', '-i', str(path),
               '-ar', '16000', '-ac', '1', '-f', 'f32le', '-']
    pcm = np.frombuffer(subprocess.check_output(command), np.float32).copy()
    mel = whisper.log_mel_spectrogram(whisper.pad_or_trim(pcm), n_mels=model.dims.n_mels)
    tokens = [token for character in line for token in tokenizer.encode(character)]
    alignment = find_alignment(model, tokenizer, tokens, mel, len(pcm)//160)
    items = []
    for item in alignment:
        chars = item.word.strip()
        ends = np.linspace(item.start,item.end,len(chars)+1)
        for i, char in enumerate(chars):
            items.append({'char':char,'start':round(float(ends[i]),3),'end':round(float(ends[i+1]),3)})
    if ''.join(i['char'] for i in items) != line:
        raise ValueError(f'Alignment text mismatch for {name}')
    print(name, [(i['char'],i['start'],i['end']) for i in items],flush=True)
    results[name] = items
args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
