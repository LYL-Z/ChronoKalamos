# Supabase 安全审查闭环

> 复核日期：2026-07-28
>
> 项目：`hqxtmaczhemaxjdfjtcz`

## 结论

数据库层的两个实质问题已经修复：

1. 四个公开业务 RPC 不再使用 `SECURITY DEFINER`。
2. `phone_auth_audit` 不再处于“RLS 已启用但没有策略”的状态。

泄露密码保护仍为关闭。当前组织显示为 Free 计划。Supabase 官方把该能力限定为 Pro
及以上。代码、SQL 迁移和 Cloudflare 均不能绕过这一计划限制。

## 已应用修复

迁移 `20260728110532_phase9_security_invoker_and_audit_policy` 完成以下处理：

- 公开 RPC 使用 `SECURITY INVOKER`。
- AAL2 与所有者检查位于 `private` schema 的受保护函数。
- 公开角色不能直接执行未检查实现。
- `phone_auth_audit` 对 `anon` 与 `authenticated` 使用 restrictive 全拒绝策略。
- 审计表权限仅授予 `service_role`。

## 验证证据

已执行：

```powershell
npm run test:contracts
npm run lint
npm run typecheck
npm run test:supabase:live
```

结果：

- 安全契约测试 19/19 通过。
- lint 与 TypeScript 检查通过。
- 真实 Supabase 隔离测试 3/3 通过。
- Advisor 不再报告公开 `SECURITY DEFINER` RPC。
- Advisor 不再报告 `phone_auth_audit` 无策略。

匿名访问提示仍存在。这符合游客账户设计。匿名用户通过 Supabase Auth 获得
`authenticated` 角色，owner-scoped 策略继续检查 `auth.uid()`。这不是公共读取授权。

## 用户需要做什么

若继续使用免费方案，阶段8与阶段9无需额外控制台操作。保留以下边界：

- TOTP 继续作为邮箱账户的免费第二因素。
- 不宣称泄露密码保护已启用。
- 不宣称 Supabase Advisor 零告警。

若必须消除泄露密码保护告警，用户需要：

1. 把 Supabase 组织或项目升级到 Pro。
2. 打开 Dashboard → Authentication → Attack Protection。
3. 启用 **Prevent use of leaked passwords** 并保存。
4. 通知 Codex 重新运行 Advisor，记录开关与告警结果。

该操作会改变计费，必须由账户所有者亲自确认。官方说明：
[Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。

## Cloudflare 边界

Cloudflare 负责域名、TLS 与边缘防护。它不控制 Supabase Auth 的密码泄露库检查。
因此不应为消除 Supabase Advisor 告警而修改 DNS、WAF 或 Turnstile。

本轮公开复核显示 `chronokalamos.com` 经 Cloudflare A/AAAA 地址解析，HTTPS 返回 200，
并包含 HSTS、CSP、Permissions-Policy 与 `CF-Ray`。Cloudflare API 连接器返回
`9109 Unauthorized`，所以账户级 SSL、WAF 与规则集不能写成已核验。阶段8保留这一
权限证据缺口；阶段9公开体验不受影响。
