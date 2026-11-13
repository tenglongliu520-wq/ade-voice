# I 声线切换 · 2026-11-13

用户已选定试听页的 I / M09 / 清脆男童（听感设计目标6–10岁）。参考音为既有合成角色，不是真人录音。

范围：得体说首页关联的现有声音试听、固定话术朗读和嵌入聊天已配音文本。保留全部既有台词、页面结构、模型选择、输入方式及人物动画。角色动作接口不改动，因此本次仅同步 ade-voice 仓库。

生成：使用离线 Qwen3-TTS-12Hz-0.6B-Base，参考 samples/I-M09-reference.wav。复用同角色已有且文本完全匹配的音频，其余现有22条音频以相同角色重新生成；不把原E音频仅改标签，也不使用设备默认男声替代。

执行：
1. 使用已有 Qwen Python 环境运行 src/generate_selected_voice.py --workspace 工作区绝对路径 --worker 0 --workers 2 和 worker 1。
2. 两个任务都完成后运行 src/install_voice_i.py --workspace 工作区绝对路径。安装器会核验22条均存在、参考哈希一致、音频哈希和PCM格式，再切换前端引用。
3. 运行主站 tests/i-voice.cjs 与 tests/companion.cjs，检查角色编号、台词映射、8种心情、音频哈希和未知文本拒绝跨声线回退。
4. 同步 voices/I 与运行播放代码。生成素材的清单路径 /voice-i/ 对应 voices/I/ 的音频文件。

限制：本轮只替换已有语音库，不宣称新生成的任意文本已具备实时I声线。未配音文本仍显示文字，不能播放其他角色冒充I。

发布：原站 project_id appgprj_6aac90f5f22c8191ad90faff3de76b00。当前 Sites 连接缺少该站编辑权限；不能以本地完成、GitHub推送或声音试听站的所有权代替原站发布成功。
