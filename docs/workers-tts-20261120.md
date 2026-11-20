# 2026-11-20：修复线上回答无声音

线上聊天请求成功后，语音代理在 3–7 毫秒内返回 504，尚未发出合成请求。原因是 `redirect: 'error'` 在 Cloudflare Workers 中不受支持，会立即抛出 TypeError；Node 本地测试支持这一选项，未覆盖运行环境差异。

将代理请求改为 Workers 支持的 `redirect: 'manual'`。3xx 响应继续被当作上游失败处理，不会携带服务凭据跟随重定向。音色仍严格检查为 05 / Y07，超时及中止机制不变。

新增回归测试模拟 Workers 对不支持选项的拒绝，并验证 302 不会被跟随。测试先复现失败，再通过修复；相关聊天、语音、按住说话共 16 项测试、TypeScript 检查与生产构建通过。对应站点发布版本为 58。

Cloudflare 运行时说明：https://developers.cloudflare.com/workers/runtime-apis/request/
