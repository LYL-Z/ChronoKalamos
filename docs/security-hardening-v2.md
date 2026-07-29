# ChronoKalamos 生产安全硬化 v2

> 审计日期：2026-07-29
>
> Supabase 项目：`hqxtmaczhemaxjdfjtcz`
> 范围：身份、RLS、RPC、Storage、AI 调用、Cloudflare 边界。未扩充历史内容。

## 结论

阶段 13 修复了迁移漂移，并增加 AI 调用的成本熔断与审计。数据库仍有九条
Supabase Security Advisor 警告。八条来自匿名游客设计。一条来自泄露密码保护未开启。
这九条不能写成“已消除”。

游客通过 Supabase Anonymous Sign-In 获得 `authenticated` 角色。用户表策略同时检查
`auth.uid()`。因此 Advisor 会提示匿名访问，但不会把甲用户的行开放给乙用户。真实双用户
测试已覆盖存档、回合、检查点、上传元数据、私有对象、更新和删除。

## 迁移对账

远程迁移共 27 份。本地现在逐项同名。两份 Phase 11 文件原先时间戳不一致，已经按远程
记录更名：

- `20260729063339_phase11_voice_line_candidates.sql`
- `20260729063433_phase11_public_beta_runtime.sql`

Phase 13 远程迁移为：

- `20260729130650_phase13_ai_budget_and_audit.sql`

CI 使用 `supabase/migration-lock.json` 检查文件名、顺序和遗漏。它不能替代 SQL 语义审计。

## RLS、授权和 RPC

用户数据表均启用 RLS。浏览器只能读取本人行。业务写入经受控 RPC 或服务端事务完成。
`phone_auth_audit` 与 `ai_call_audit` 对 `anon` 和 `authenticated` 使用 restrictive 全拒绝
策略。两张表的客户端表权限均已撤销。

公开 schema 中仍有 `SECURITY DEFINER` 函数。这不是自动漏洞。以下条件已现场核验：

- `reserve_ai_call`、`complete_ai_call`、`cleanup_ai_call_audit` 只授予
  `postgres` 与 `service_role` 执行权。
- 函数固定空 `search_path`。
- AI 配额函数校验所有参数。
- 计数器先获取全局事务锁，再获取用户事务锁。锁顺序固定。
- 浏览器调用配额 RPC 会被拒绝。

面向浏览器的四个业务 RPC 仍为 `SECURITY INVOKER`。身份与 AAL2 检查留在
`private` schema 的受控函数中。服务端提交、失败记录、清理和供应商审计函数保持
service-role only。

## 私有 Storage 与删除

`user-uploads` 桶现场值如下：

- `public = false`
- 单对象上限：5 MiB
- MIME：PNG、JPEG、WebP

Storage 策略同时检查桶名、用户 UUID 路径和对象 `owner_id`。业务元数据表再检查
`owner_id`。删除测试覆盖外部用户无法删除对象或元数据；所有者可通过 Storage API
删除对象，并通过 RLS 删除元数据。

## AI 日额度与隐私日志

默认额度为每用户每日 40 次、全站每日 500 次。一次验证重试会再占用一次额度。
重复 `clientTurnId + attempt` 不会再次调用模型。额度耗尽时先拒绝，再调用供应商。

`ai_call_audit` 只保存：

- 用户 UUID；
- `clientTurnId`；
- 尝试序号；
- 供应商名；
- 结果码；
- 延迟；
- 时间。

它不保存提示词、叙事、邮箱、手机号、IP、访问令牌、供应商响应正文或密钥。用户删除时，
相关记录通过外键级联删除。默认运维保留期为 30 天，最短允许保留期为 7 天。

应用日志使用 `SECURITY_AUDIT_SALT` 对用户 UUID 做不可逆短摘要。未配置 salt 时，日志
省略用户字段。`AI_TURNS_ENABLED=false` 是服务端紧急停止开关。

## Advisor 处置

| Advisor 项 | 状态 | 处置 |
|---|---|---|
| `phone_auth_audit` 无策略 | 已消除 | restrictive 全拒绝策略；仅 service role |
| 公开业务 RPC 为 `SECURITY DEFINER` | 已消除 | 浏览器 RPC 改为 invoker；特权实现收进 private |
| AI 审计表无策略 | 未出现 | restrictive 全拒绝策略；仅 service role |
| 匿名访问策略，共 8 条 | 接受的产品风险 | 游客试玩所需；`auth.uid()` 隔离；双用户现场测试 |
| 泄露密码保护关闭 | 外部计划限制 | Free 计划不可启用；邮箱确认、TOTP、限流作为补偿控制 |

泄露密码保护由 Supabase Auth 控制。代码、SQL 和 Cloudflare 都不能代替它。若升级到
Pro，需在 Authentication → Attack Protection 中启用，并重新运行 Advisor。Supabase
说明该能力适用于 Pro 及以上计划。

## 依据

- Cloudflare. “Full (Strict).” *Cloudflare Docs*, 2026,
  <https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/>.
- Supabase. “Anonymous Sign-Ins.” *Supabase Docs*, 2026,
  <https://supabase.com/docs/guides/auth/auth-anonymous>.
- Supabase. “Password Security.” *Supabase Docs*, 2026,
  <https://supabase.com/docs/guides/auth/password-security>.
- Supabase. “Row Level Security.” *Supabase Docs*, 2026,
  <https://supabase.com/docs/guides/database/postgres/row-level-security>.
- Supabase. “Securing Your API.” *Supabase Docs*, 2026,
  <https://supabase.com/docs/guides/api/securing-your-api>.
