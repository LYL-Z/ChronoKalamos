# 阶段3安全与隐私边界

## 浏览器密钥

浏览器只读取 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。publishable key 用于识别项目，不授予绕过 RLS 的权限。服务角色密钥不得出现在 `.env.example`、客户端模块、构建产物或 Sites 环境中。

## 数据隔离

`profiles`、`game_sessions`、`game_turns`、`game_checkpoints` 和 `user_uploads` 全部启用 RLS。选择、插入、更新和删除均检查 `auth.uid()`。私有桶额外检查：

- 桶必须是 `user-uploads`；
- 对象路径首段必须等于用户 UUID；
- `storage.objects.owner_id` 必须等于当前用户 UUID；
- 文件格式限 PNG、JPEG、WebP；
- 文件大小不超过 5 MiB。

存储对象只能通过本人 JWT 或后续生成的短时签名 URL 读取。应用通过 Storage API 删除对象，不直接修改 `storage` schema。

## 当前未完成的验证

静态契约测试只能证明迁移包含预期策略，不能证明云端项目已正确应用。阶段3退出必须在已迁移的 Supabase 测试项目运行 `npm run test:supabase:live`。该测试创建两个匿名用户，并验证用户 B 无法读取或覆盖用户 A 的存档，也无法下载用户 A 的私有对象。

没有项目凭证时，该测试会明确跳过。跳过不等于通过。

## 依赖审计

2026-07-18 的 `npm audit --omit=dev` 报告 2 项中危，均来自 Next 依赖的 PostCSS。完整审计另有 1 项低危、7 项中危和 6 项高危，主要位于 Vite、Wrangler、Miniflare 与 Cloudflare 开发工具链。审计建议的 Next 修复会降级到 9.3.3，不能采用；这会破坏现有 React 19 和 Vinext 兼容关系。阶段6必须在升级 Sites/Vinext 锁定栈后重新审计。在修复前，不应把当前版本称为公开测试版。
