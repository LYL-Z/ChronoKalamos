# 阶段 7 免费 TOTP 验收清单

这份清单区分“已经实现”与“已经由真实身份验证器验收”。部署成功不等于身份链路已
完成。

| # | 启用证据 | 当前状态 | 验证方法 | 剩余卡点 |
|---|---|---|---|---|
| 1 | 只向已确认邮箱账户开放 | 已实现 | 检查 `IdentityPanel` 的正式账户条件 | 真实邮箱账户复核 |
| 2 | 注册、二维码、密钥与 6 位码验证 | 已实现 | TOTP helper 单测与组件契约测试 | 用真实身份验证器扫码 |
| 3 | 登录后识别 `aal1 → aal2` | 已实现 | `getAuthenticatorAssuranceLevel` 单测 | 退出再登录实测 |
| 4 | 敏感数据强制 AAL2 | 已应用 | Supabase 查询应返回 7 条 restrictive 策略 | AAL1 拒绝截图或日志 |
| 5 | 三个 definer RPC 不绕过门禁 | 已应用 | 查询 private 原实现不可执行，public wrapper 返回 `mfa_required` | 真实 AAL1 RPC 调用 |
| 6 | 备用因子 | 已实现 | 添加第二因子，列表显示主与备用 | 第二台受控设备验证 |
| 7 | 全部因子丢失的恢复边界 | 已写明 | 审核 [`docs/totp-mfa.md`](./totp-mfa.md) | 管理员审计重置流程尚未实现 |
| 8 | 真实注册、退出、再登录和双用户隔离 | 未完成 | 按下方人工步骤执行 | 需要用户持有的 TOTP 应用 |

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

前三项必须通过。最后一项必须实际运行；跳过不算通过。TOTP 能力在表中第 8 项完成前
保持 `evaluating`。

## 2026-07-27 自动验证记录

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
