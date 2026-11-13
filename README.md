# 阿德语音库 · ade-voice

得体说阿德的声线配置、合成角色参考音、固定话术音频及播放适配。

## 本地试听与验证

需要 Python 3.9+，在本仓库目录运行 `python tools/preview.py`，打开 http://127.0.0.1:4190/ 即可逐段播放22条台词，无需模型、账号或额外依赖。预览只监听本机。

运行 `node --test tests/voice.cjs`（Node.js 18+）核验参考音、音频哈希、8种心情及播放路由；运行 `python tools/verify_preview.py` 检查HTTP资源与目录隔离。

试听库可独立运行。下方生成器和安装器仍依赖 `--workspace` 指向的完整得体说工作区，不是克隆后即可任意文本实时合成的服务。

## 当前选择

2026-11-13 用户指定 I / M09「清脆男童」。`voices/selected.json` 记录选择；`voices/I/manifest.json` 记录现有22条台词与音频哈希；`samples/I-M09-reference.wav` 为原有合成候选的参考音，不是真人录音。

## 运行范围

- `src/generate_selected_voice.py`：使用已有离线 Qwen3-TTS 环境生成原站现有台词的 I 声线版本，可断点续做。
- `src/install_voice_i.py`：先核验完整性，再替换主站声音引用，不修改人物动画、台词和页面布局。
- `src/frontend/`：主站的语音选择和播放适配源码快照；依赖仍由得体说主站提供，不是一个独立可运行的网站。
- `src/local-ai/server.cjs`：主站本地语音路由源码快照，不包含模型及私密配置。
- `docs/voice-i-switch-20261113.md`：来源、核验、安装与发布限制。

生成示例：在已安装 `qwen_tts`、PyTorch、numpy、soundfile 的环境运行 `python src/generate_selected_voice.py --workspace 工作区绝对路径 --model 模型目录 --worker 0 --workers 1`。模型权重不随本仓库提交。

## 素材和安全

现有台词由已选合成角色生成，记录编号、文本、参考来源与SHA256。未配音的新文本保留文字，不使用设备默认声音替代I。个人录音、凭据、密钥、日志和模型权重不纳入提交。

GitHub同步不等于网站已经发布。主站仍需在原 Sites 项目中单独完成发布。

## 配套仓库

人物动画：[ade-character-animation](https://github.com/tenglongliu520-wq/ade-character-animation)。本次仅更换声线，没有修改双方联动接口。

目前未添加开源许可证；仓库保持私有。

Windows 本机也可双击 `启动预览.cmd`，再打开上面的本机地址；关闭启动窗口即可停止预览。脚本优先使用本机现有的 D:/AI/Ade-companion-20261104/venv Python，其他电脑使用 PATH 中的 Python。
