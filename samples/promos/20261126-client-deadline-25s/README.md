# 甲方催材料 25 秒宣传片配音

2026-11-26。王总是独立设计的中年男中低音，开场催得急，文件拍桌后追问。员工的迟疑和汇报使用同一合成声线。汇报从承认漏报进度转向说明正文、两个待核数字、十分钟更新和一起接电话。

阿得的练习提示和尾卡使用 05 / Y07「明亮亲切」。练习提示使用 [已选参考音](../../../voices/selected.json) 新合成，尾卡沿用 [同日春节篇的同一句品牌配音](../20261126-cny-marriage-25s/audio/vo.wav)。

- `audio/` 包含未混音的合成声轨。拍桌、键盘、发送提示和配乐由渲染脚本生成。
- `synthesize.py` 使用本地 Qwen3-TTS。先运行 `--stage design`，再运行 `--stage clone`。两次均传入 `--models`（两个模型的父目录）、`--voice-repo`（本仓库根目录）和 `--out`（音频输出目录）。尾卡的 `outro.wav` 从上面链接的 05 原片段复用。
- `render.py` 使用 Python、NumPy、Pillow、OpenCV 和 imageio-ffmpeg，字体为 Windows 微软雅黑。运行前设置 `CNY_BUILD`（临时目录）、`CNY_VOICE_DIR`（配音目录）、`CNY_ASSETS`（10 张编号分镜图片目录）和 `CNY_OUTPUT`（成片 MP4 路径）。

分镜图片和成片保留在项目本地。

对嘴使用 `lip-cues.json`。它由 `align_dialogue.py` 用 Whisper 将已知普通话台词与成片的三条 `*-fitted.wav` 对齐。修改配音后，先以 `CNY_AUDIO_ONLY=1` 生成拟合后的声轨，再用对齐脚本重新生成时间表。表情根据每句的情绪转换编排，眼神、眉头、头部和肩部都有独立的动作曲线。
