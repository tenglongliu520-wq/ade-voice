# 语音与人物动画接入

## 当前接口

先加载 `ade-motion-model.js`，再加载 `companion-avatar.js`，实例化 `new CompanionAvatar(host)` 并等待 `avatar.ready`。生产脚本默认从脚本同目录加载图集；独立预览服务器将该路径映射到 assets/hanfu-20261112/。

- `setState('idle' | 'listen' | 'think' | 'talk' | 'wave')` 切换状态。
- `greet()` 挥手，`setPaused(boolean)` 暂停或恢复。
- 将真实音频的 Web Audio AnalyserNode 赋给 `avatar.analyser`，或在播放过程中定期调用 `setSpeechLevel(0–1)`；外部音量260ms无更新后归零。
- 音频暂停、结束、停止或出错时调用 `setState('idle')` 与 `setSpeechLevel(0)`。
- `destroy()` 释放渲染器；页面隐藏时停止绘制，减少动态时保持静态。

I/M09已配音文本由语音库 `AdeVoice.plan(text)` 规划；未知文本返回空列表，不使用其他声音替代。`/voice-i/` 对应语音库 `voices/I/`。

## iframe 与边界

原主站使用 `ade-avatar-connect` 握手和 `ade-avatar-motion` 消息，校验来源及源窗口。独立演示直接挂载角色，不扩大来源白名单。

早期文档中的 `speech-start`、`speech-level` 等通用事件总线仍是建议方案，当前代码没有该事件总线。

当前基线为2026-11-13的I/M09音频与古装阿德动画，来源记录见各库版本文档。独立预览不修改已发布网站。接口变化应同步两仓库。
