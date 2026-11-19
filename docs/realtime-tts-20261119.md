# 实时回答语音修复 · 2026-11-19

## 原因与修复

来源：得体说 `sites/detishuo-home`。首页实际载入 `public/ade-chat-assets/app.js`，本仓库快照为 `src/frontend/cloud-chat.js`。

旧播放器的 `if(true)` 分支强制只匹配22条预录语音，实时生成的文本匹配不到就跳过；主站没有 `/api/ade/tts`。因此问答正常也不会朗读新回答。

新增播放器分支：完整匹配预录台词时继续播放原文件，其余文本请求同源 `/api/ade/tts`。新增Worker路由代理到已选声线服务。服务未连接时显示具体原因并保留重听按钮；不会使用设备默认声音。首页iframe增加 `autoplay` 权限。人物消息接口没有改变。

## 服务部署

`src/serve_selected_voice.py` 复用现有 Qwen3-TTS 0.6B Base 模型和公开合成参考音；启动时核验参考音SHA256，只提供I/M09。合成结果在内存中返回，不保存对话或用户音频，不记录请求内容。独立部署主机需要已安装torch、qwen_tts、numpy、soundfile。

1. 在服务进程环境设置随机密钥 `ADE_TTS_TOKEN`（至少24字符；不要写入仓库或命令行）。
2. 在已有Qwen环境运行：`python src/serve_selected_voice.py --model 模型绝对路径`。默认只监听127.0.0.1:4191；POST路径为 `/tts`。
3. 云端使用时，需要由可访问的HTTPS反向代理转发到此服务，保留 Authorization 和 X-Ade-Voice；必须限制访问和请求频率。不要把开发电脑的localhost地址填入云端配置。
4. 在原Sites服务端环境设置 `ADE_TTS_URL`（HTTPS完整 `/tts` 地址）和同一个 `ADE_TTS_TOKEN`。仅设置两项且服务可达后，新文本才可实时出声。`GET /api/ade/tts`反映是否配置，不能代替真实合成健康检查。

CPU首次加载和合成有明显等待，实际线上延迟仍需部署后测量。生产服务应使用适合实时合成的计算资源。服务端密钥不会发送给浏览器。当前新增功能用于网页，未修改原生微信小程序。

## 验证与发布边界

主站 `node --test tests/ade-tts.test.mjs tests/ade-cloud-chat.test.mjs tests/hold-to-talk.cjs`，另运行 `node tests/i-voice.cjs`。前者覆盖新文本合成、预录播放、异常、声线校验及语音草稿；后者校验22条现有音频及8种心情。模拟测试不代表iOS/微信真机验收。

新增代码和接入说明同步GitHub不等于主站上线。当前Sites连接无法取得原站写入凭证（project not found）；上线还需要恢复原站所属账号的写入权限，并配置上述HTTPS语音服务。布局建议另存主站设计文档，等待确认。

本机实测：使用已有0.6B Base模型，对“你好，今天想聊些什么？”完成真实I/M09合成，返回115244字节RIFF/WAV；测试进程已退出。该验证不包含线上HTTPS代理、生产发布或手机扬声器。
