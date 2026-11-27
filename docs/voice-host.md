# 阿德 05 号实时朗读

线上问答的开关表示用户想听回答。GET /api/ade/tts 的 ready 根据当前语音主机最近一分钟的心跳计算。主机离线时，回答文本和重听按钮仍可用。

语音主机运行于现有 Qwen3-TTS 环境，使用 voices/selected.json 固定的合成参考音。主机定期向得体说的 /api/ade/voice-host 发起 HTTPS 请求，不需要开放公网端口或更新临时域名。本机模型仅监听回环地址。每次启动主机和每次朗读请求分别生成内存中的临时密钥，任务内容和结果经过 AES-GCM 加密。网站取回音频后删除队列记录，过期记录由在线主机清理。

在 Sites 中设置独立秘密变量 ADE_VOICE_HOST_TOKEN。Windows 运行账号将同一值以 CurrentUser DPAPI 加密保存在代码目录之外。用 PowerShell 7 启动 tools/start-voice-host.ps1，传入 CredentialFile、Python、Model、Node 四个绝对路径。Node 需支持 Web Crypto 和环境代理。启动脚本确保一个登录会话只运行一个主机，进程异常退出后会重启。网站需要部署对应的 D1 迁移和两个 API 路由。

主机需要联网并保持运行。验收时发送全新的短句，确认 POST /api/ade/tts 返回 audio/wav、标记 05-Y07，并检查网页自动播放与重听。仅检查在线状态无法验证实际合成。
