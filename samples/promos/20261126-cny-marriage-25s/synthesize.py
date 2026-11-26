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

MOTHER = '有女朋友没？没有就回来相亲。'
PRESSURE = '妈，最近一直加班。也怕裁员轮到我。'
BRAND = '不知道怎么说，来得体说哦。'
SON_LINES = {
    'hesitate': '妈……我……',
    'dinner': '今年先别安排相亲了。我想回家吃顿你做的饭。',
    'tired': '下次，先问我累不累吧。我其实挺想听你问这一句。',
}


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
            ('mom', MOTHER, 251126,
             '55到60岁中国妈妈的成熟、偏低厚的女中音，有一点年龄带来的沙润，'
             '生活化的普通话。像在厨房里随手给成年儿子打电话。开头是熟门熟路地问，'
             '问句后顿半拍，后半句是习惯性催促，语气直接、有点管，但不是发火。'
             '避免少女的清亮音色、配音播音腔和长尾音，清晰紧凑。'),
            ('pressure', PRESSURE, 251128,
             '中国男性32到35岁，疲倦的男中音，胸声有厚度和一丝熬夜后的干涩。'
             '深夜坐办公室小声跟妈妈说话，开口略犹豫，“一直加班”比较克制，'
             '句间短促地停一下，第二句更低、更实，让人听见他承认害怕的难处。'
             '用自然的生活普通话，禁止播音、油腔、故意压喉、哭腔和延长句尾。'),
        ]
        for name, line, seed, direction in jobs:
            torch.manual_seed(seed)
            waves, rate = model.generate_voice_design(
                text=line, language='Chinese', instruct=direction,
                max_new_tokens=172, top_p=.90, temperature=.78,
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
        ref_audio=str(args.out / 'pressure.wav'), ref_text=PRESSURE,
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
