# 阿德语音库 · ade-voice

得体说阿德的声线配置、合成角色参考音、固定话术音频及播放适配。

公开试听入口：[阿德01–10声音试听](https://tenglongliu520-wq.github.io/ade-voice/)。由 GitHub Pages 从 main 分支发布，页面只显示01–10编号。发布与线上资源核验后即可分享，无需登录或下载。

## 本地试听与验证

需要 Python 3.9+，在本仓库目录运行 `python tools/preview.py`，打开 http://127.0.0.1:4190/ 即可逐段播放22条台词，无需模型、账号或额外依赖。预览只监听本机。

运行 `node --test tests/voice.cjs`（Node.js 18+）核验参考音、音频哈希、8种心情及播放路由；运行 `python tools/verify_preview.py` 检查HTTP资源与目录隔离。

试听库可独立运行。下方生成器和安装器仍依赖 `--workspace` 指向的完整得体说工作区，不是克隆后即可任意文本实时合成的服务。

## 当前选择

最新保留10个候选：**Y02、Y04、Y05、Y06、Y07、Y08、Y09、N02、N05、N10**。打开 [10人混合试听页](auditions/20261118-under20/selected10/index.html)，原编号和年龄目标保留，混合组不再全部低于20岁。最终主声尚未选定，正式I/M09不变。

2026-11-18 首轮保留少年候选 **Y02、Y04、Y05、Y06、Y07、Y08、Y09**，详见该批 `shortlist.json` 与 `Y-shortlist-comparison.wav`；暂未选定最终主声，正式I/M09不变。

新增候选：[`2026-11-18 · 10位20岁以下少年男声`](auditions/20261118-under20/README.md)。Y01–Y10的听感设计目标为15–19岁，目录内 `index.html` 可离线试听，或在本地预览服务访问 `/auditions/20261118-under20/index.html`。全部待用户听审，不替换正式I/M09。

新增候选：[`2026-11-16 · 10位青年磁性男声`](auditions/20261116-young-men/README.md)。打开该目录的 `index.html` 可离线试听，也可在预览服务访问 `/auditions/20261116-young-men/index.html`。本批20–29岁为设计目标，尚未用户听审，不改变以下正式已选声线。

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

仓库已按用户要求于2026-11-13改为公开，任何人可查看和下载。目前未添加开源许可证；公开可见不代表已授予代码、声音和角色素材的任意使用或再分发许可。

Windows 本机也可双击 `启动预览.cmd`，再打开上面的本机地址；关闭启动窗口即可停止预览。脚本优先使用本机现有的 D:/AI/Ade-companion-20261104/venv Python，其他电脑使用 PATH 中的 Python。

## 2026年11月16日 按住说话

新增浏览器麦克风按住录音、松开转草稿和上滑取消的共享模块；不改变已选I声线或回答播报。接入与兼容边界见 [按住说话接入说明](docs/hold-to-talk-20261116.md)，测试命令为 `node --test tests/hold-to-talk.cjs`。主站快照需要主站DOM，不是原生微信小程序。

## 2026年11月19日 实时回答语音

修复实时回答只能匹配预录片段的问题，新增 I/M09 合成服务及主站代理快照。部署和验证说明见 [实时语音接入](docs/realtime-tts-20261119.md)。服务需单独部署并配置，GitHub同步不表示主站已上线。

## 2026年11月19日 首页对话优先

首页接入快照已按“阿德对话为主、场景快捷入口在后”整理，保留语音草稿、手动发送与人物动作。来源和核验见 [首页调整说明](docs/home-dialogue-20261119.md)。主站尚待Sites发布。

## 当前生产选择更新（2026-11-20）

用户已指定05 / Y07「明亮亲切」，取代首页及相关播报的I/M09选择。详见 [05号语音修复与验证](docs/voice05-20261120.md)。此前I记录作为历史保留。
