"""Render synthetic dialogue for the 25-second Spring Festival promo."""
import argparse
import hashlib
import json
import os
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


BOSS = '甲方都催三遍了！材料呢？'
REPORT = '王总，刚才没及时报进度。正文发您了，还剩两个数。十分钟后我主动更新。甲方来电，我跟您一起接，我来讲清楚。'
BRAND = '来得体说，按场景练表达。'
SON_LINES = {'hesitate': '我……我在改……'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--models', type=Path, required=True)
    parser.add_argument('--voice-repo', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--stage', choices=['design', 'clone'], required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(8)
    torch.set_num_interop_threads(2)

    def load(model_name):
        return Qwen3TTSModel.from_pretrained(
            str(args.models / model_name), device_map='cpu',
            dtype=torch.float32, attn_implementation='sdpa',
        )

    def write(name, waves, rate):
        signal = np.asarray(waves[0], dtype=np.float32).reshape(-1)
        if not np.isfinite(signal).all() or np.max(np.abs(signal)) < .05:
            raise RuntimeError(f'Invalid speech for {name}')
        destination = args.out / f'{name}.wav'
        temporary = destination.with_suffix('.partial.wav')
        sf.write(temporary, signal, rate, subtype='PCM_16')
        temporary.replace(destination)
        print(f'{name}: {len(signal)/rate:.2f}s', flush=True)

    if args.stage == 'design':
        model = load('Qwen3-TTS-12Hz-1.7B-VoiceDesign')
        jobs = [
            ('boss', BOSS, 261126,
             '中国中年男领导，45岁上下，偏厚男中低音。办公室桌边压着火催交付，'
             '“催三遍了”重读，停一小拍后短促逼问“材料呢”，像真的着急，普通话自然清楚，不要播音。'),
            ('report', REPORT, 261128,
             '中国职场男性约30岁，中音偏暖，办公室近距离真实口语。开头语气歉疚但直接；'
             '“正文发您了，还剩两个数”逐渐稳下来；十分钟后主动更新更笃定，'
             '最后“我来讲清楚”平实有担当，落句干净。全段连贯紧凑，正常偏快，停顿短，不用播音腔。'),
        ]
        for name, line, seed, direction in jobs:
            torch.manual_seed(seed)
            waves, rate = model.generate_voice_design(
                text=line, language='Chinese', instruct=direction,
                max_new_tokens=440, top_p=.90, temperature=.78,
            )
            write(name, waves, rate)
        return

    model = load('Qwen3-TTS-12Hz-0.6B-Base')
    manifest = json.loads(
        (args.voice_repo / 'voices/selected.json').read_text(encoding='utf-8')
    )
    reference = args.voice_repo / manifest['reference']
    if (manifest['selected_voice'], manifest['voice_id']) != ('05', 'Y07'):
        raise ValueError('Expected the approved 05 / Y07 voice')
    if hashlib.sha256(reference.read_bytes()).hexdigest() != manifest['reference_sha256']:
        raise ValueError('Reference checksum mismatch')
    brand = model.create_voice_clone_prompt(
        ref_audio=str(reference), ref_text=manifest['reference_text'],
    )
    torch.manual_seed(251105)
    waves, rate = model.generate_voice_clone(
        text=BRAND, language='Chinese', voice_clone_prompt=brand,
        max_new_tokens=115, top_p=.88, temperature=.73,
    )
    write('vo', waves, rate)
    son = model.create_voice_clone_prompt(
        ref_audio=str(args.out / 'report.wav'), ref_text=REPORT,
    )
    for index, (name, line) in enumerate(SON_LINES.items()):
        torch.manual_seed(251133 + index)
        waves, rate = model.generate_voice_clone(
            text=line, language='Chinese', voice_clone_prompt=son,
            max_new_tokens=165, top_p=.88, temperature=.76,
        )
        write(name, waves, rate)


if __name__ == '__main__':
    main()
