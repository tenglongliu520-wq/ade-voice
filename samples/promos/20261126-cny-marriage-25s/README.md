# 春节前催婚 25 秒宣传片配音修订

2026-11-26。妈妈是独立设计的成熟女中音，成片加电话带宽。儿子是为三十多岁加班男性设计的合成男中音，四段对白沿用同一合成参考。开头迟疑，谈到裁员时压低，讲到回家时放软，最后一句轻收。

得体说品牌台词为「不知道怎么说，来得体说哦。」使用已选 05 / Y07 的同一参考音合成。参考音、准确参考文本和 SHA-256 见 [已选声线](../../../voices/selected.json)。

- `audio/` 为本次六段未混音的合成声轨。
- `synthesize.py` 使用本地 Qwen3-TTS。按顺序执行 `--stage design` 和 `--stage clone`，两次均传入 `--models`（两个已安装模型的父目录）、`--voice-repo`（本仓库根目录）和 `--out`（声轨输出目录）。
- `render.py` 使用 Python、NumPy、Pillow、OpenCV 和 imageio-ffmpeg。需在 Windows 提供微软雅黑字体，设置 `CNY_BUILD`（已存在的临时目录）、`CNY_VOICE_DIR`（声轨目录）、`CNY_ASSETS`（10 张已编号的分镜图片目录）和 `CNY_OUTPUT`（成片 MP4 路径）。

原图和完整成片留在项目本地。
