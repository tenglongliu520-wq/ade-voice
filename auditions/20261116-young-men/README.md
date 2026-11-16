# 10位青年磁性男声 · 2026-11-16

用户希望替换I音的童声方向，寻找30岁以下、具有磁性、吸引力和亲和力的男性声音。本批以20–29岁成年男性听感设计10个独立合成角色，各有独立描述与随机种子；不是同一音频变调，不模仿任何真人。

打开 `index.html` 即可离线试听，先听编号再显示设计标签。`N01-N10-comparison.wav` 按编号顺序连续播放，间隔1秒。`audio/` 为统一播放响度目标的副本，`raw/` 为原始合成音频，`manifest.json` 记录哈希与技术核验结果。技术检查不能证明主观磁性、年龄听感或不同人物辨识度，仍需用户听审。

使用既有离线 Qwen3-TTS-12Hz-1.7B-VoiceDesign 环境。用安装了 qwen_tts、PyTorch、numpy、soundfile 的 Python 运行 `generate.py --model 模型目录`；完成后运行 `package.py`。模型权重不提交。生成脚本默认本机原有模型目录，可用参数改为自己的路径。

`catalog.json` 是本批设计配置；`progress-*.json` 仅为本机续做记录，不提交Git。正式已选声线 `voices/selected.json` 保持I/M09，选定并完成跨句验证后另行切换。

模型来源：https://github.com/QwenLM/Qwen3-TTS 。本批为文字描述生成的合成声音，不涉及用户录音。
