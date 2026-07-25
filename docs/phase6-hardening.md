# 阶段 6：公开测试版硬化记录

## 已完成

- 生产依赖审计已通过。`npm audit --omit=dev --audit-level=high` 返回 0 个高危漏洞。
- Next.js 升级至 `16.2.11`；`postcss` 与 `sharp` 通过 `overrides` 固定到已修复版本。
- Worker 统一添加 CSP、HSTS（仅 HTTPS）、`X-Content-Type-Options`、`X-Frame-Options`、
  `Referrer-Policy`、`Permissions-Policy`、跨源策略和 API `no-store`。
- 新增无敏感配置的 `/api/health` 健康检查。
- 回合接口限制请求体为 24 KiB，限制 Bearer 凭证长度，校验 session UUID，并对 SSE
  响应应用同一安全策略。
- Supabase `game_turn_requests` 增加每用户每分钟最多 12 个新回合预留。限流在数据库
  事务触发器中执行，并用 advisory lock 防止并发绕过。
- 新增 service-role-only 的 `cleanup_game_turn_requests(timestamptz)` retention hook。
- DeepSeek 服务地址必须使用 HTTPS；超时同时处理 `TimeoutError` 与 `AbortError`。
- 提示注入筛查先做 NFKC、零宽字符和空白归一化。
- 密码输入补齐显式 label，保持键盘和辅助技术可识别。

## 已验证

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:contracts`
- `npm run test:supabase:live`
- `npx supabase db push --linked`
- Supabase security/performance advisors

Supabase live suite 现在包含三项：历史内容公开/草稿隔离、双用户隔离与游客升级、以及
每用户回合限流的真实远端验证。

## 保留的明确边界

- Supabase 的匿名登录策略是产品必需项，因此相关 advisor 警告保留。
- `create_or_get_game_session`、`delete_game_session` 和 `reserve_game_turn` 是经过
  `auth.uid()` 校验、固定空 `search_path` 和最小授权的 owner-scoped `SECURITY DEFINER`
  RPC。advisor 仍会提示其对 `authenticated` 暴露，这是当前存档模型的有意取舍。
- Supabase Auth 的 leaked-password protection 需要在项目 Auth 设置中启用；当前项目 advisor
  仍报告该设置关闭。未取得项目设置写权限前，不把它伪称为已完成。
- 完整 CDN、Cloudflare Worker 资产 URL、生产错误率和真实移动设备性能仍需上线后持续观测。
