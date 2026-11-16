# 按住说话接入 2026年11月16日

## 本轮范围

实现网页直接调用手机麦克风的按住说话交互；回答播报、I声线与人物素材均未改变。

- 首页和聊天页加载hold-to-talk.js后调用AdeHoldToTalk.mount。
- 按下按钮请求getUserMedia权限，释放权限探测流后交由浏览器SpeechRecognition识别；松开停止并提交可编辑草稿，上滑60px取消，不自动发送。
- 权限未决时松手、失去指针捕获、页面隐藏及超时均取消；延迟返回的麦克风流立即关闭。空格和回车支持按住操作。
- iframe显式allow="microphone"，仍受宿主页Permissions-Policy和系统权限约束。必须使用HTTPS或localhost。
- 浏览器识别可能通过浏览器提供商在线处理；页面不保存录音，隐私提示已更新。
- 部分手机/微信浏览器没有SpeechRecognition。此时如实提示并保留打字，不把接口存在或模拟测试通过称为真机转写验收；未加入原生微信小程序wx录音接口。

## 文件

src/frontend为主站快照，依赖主站DOM、CompanionAvatar、API及静态资源；不是独立可运行的小程序。cloud-chat.js对应主站public/ade-chat-assets/app.js，cloud-chat.css对应该页面样式。

## 核验与发布

node --test tests/hold-to-talk.cjs：正常草稿、取消、拒绝权限和延迟授权释放。主站另外用390px视口模拟浏览器设备API检查首页与聊天接线；模拟不替代物理麦克风与中文识别测试。GitHub同步不等于主站已发布。
