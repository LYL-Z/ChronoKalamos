# 阶段 7 免费 TOTP 验收清单

这份清单区分“已经实现”与“已经由真实身份验证器验收”。2026-07-27，用户报告下述
人工链路通过；该声明不等于 Codex 独立观察了身份验证器屏幕。

| # | 启用证据 | 当前状态 | 验证方法 | 剩余卡点 |
|---|---|---|---|---|
| 1 | 只向已确认邮箱账户开放 | 已通过 | `IdentityPanel` 条件与真实邮箱账户复核 | 无 |
| 2 | 注册、二维码、密钥与 6 位码验证 | 已通过 | TOTP helper、组件契约测试与用户人工验收 | 无 |
| 3 | 登录后识别 `aal1 → aal2` | 已通过 | 单测与用户退出再登录验收 | 无 |
| 4 | 敏感数据强制 AAL2 | 已通过 | 7 条 restrictive 策略与用户 AAL1/AAL2 人工验收 | 无 |
| 5 | 三个 definer RPC 不绕过门禁 | 已通过 | private 权限检查、public wrapper `mfa_required` 与人工链路 | 无 |
| 6 | 备用因子 | 已通过 | 第二因子列表与两因子挑战人工验收 | 定期回归 |
| 7 | 全部因子丢失的恢复边界 | 已写明 | 审核 [`docs/totp-mfa.md`](./totp-mfa.md) | 管理员审计重置流程尚未实现 |
| 8 | 真实注册、退出、再登录和双用户隔离 | 已通过 | 用户于 2026-07-27 报告人工链路通过；自动化双用户隔离通过 | 定期回归 |

## 人工验收步骤

1. 用一个受控邮箱账户登录公开站。
2. 启用 TOTP，扫描二维码并输入 6 位码。
3. 确认当前存档可读写，并确认其他会话被退出。
4. 退出后重新用邮箱登录。不要先输入 TOTP。
5. 确认页面不加载存档；直接调用存档 RPC 应得到 `mfa_required` 或 RLS 拒绝。
6. 输入 TOTP，确认存档与私有上传恢复。
7. 添加备用因子，并分别用两个因子完成挑战。
8. 用第二个账户确认无法读取第一个账户的任何存档、回合、检查点或上传。

不得把二维码、密钥或 6 位码粘贴到 Codex 对话。Codex 只需要用户报告每一步的成功或
错误信息。

## 保持关闭

- `PHONE_AUTH_ENABLED=false`
- `PHONE_AUTH_PROVIDER=mock`
- 公开身份面板不渲染 `PhoneAuthPanel`
- 不渲染 Passkey 注册或登录按钮
- 微信、QQ 和支付保持关闭

## 验证命令

```text
npm run lint
npx tsc --noEmit
npm test
npm run test:supabase:live
```

前三项必须通过。最后一项必须实际运行；跳过不算通过。本次已有用户人工验收声明，
TOTP 能力状态为 `enabled`。后续发布仍应复用该清单回归。

## 2026-07-27 自动验证记录

- 用户报告真实身份验证器注册、退出、邮箱再登录、AAL1 拒绝、TOTP 后 AAL2 恢复访问和备用因子挑战通过。
- `npm test` 通过：内容校验、lint、类型检查、构建、48 项单元测试和 16 项契约测试。
- `npm run test:supabase:live` 首次暴露 `auth.mfa_factors` 直读权限错误。策略已改为
  受限的 `private.session_meets_mfa()` helper，未向认证角色开放 Auth 表。
- 修复后，公开历史内容与限流用例通过。
- 双用户存档、回合、检查点、私有上传和游客升级单项通过，耗时约 177 秒。
- 整套连续运行曾因 Supabase TLS socket 关闭在清理阶段失败。清理 RPC 已增加仅针对
  `fetch failed/socket` 的短重试。该问题属于测试项目网络稳定性，不构成真实 TOTP
  扫码证据。
- Supabase Security Advisor 仍报告：三个有意公开给认证用户的 owner-scoped
  `SECURITY DEFINER` wrapper、匿名游客策略、关闭的 `phone_auth_audit` 无策略，以及
  leaked-password protection 未启用。TOTP wrapper 已增加 `auth.uid()`、AAL 和 owner
  检查；其余告警不能写成已解决。
