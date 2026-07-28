# ChronoKalamos 免费 TOTP 身份方案

## 范围

阶段 7 当前只推进邮箱账户的 TOTP 二次验证。它使用 Supabase Auth 的内置 MFA API，
不调用短信供应商，也不需要新增密钥。短信、手机号登录和 Passkey 暂缓。

游客仍可使用 `aal1` 建立本地浏览器身份。只有已确认邮箱的正式账户显示 TOTP 管理
入口。TOTP 是自愿启用，但启用后成为受保护数据的强制条件。

## 用户流程

1. 用户登录已确认的邮箱账户。
2. 用户选择“启用 TOTP”，用身份验证器扫描二维码。
3. 用户输入 6 位验证码。Supabase 验证因子，并使其他会话失效。
4. 后续邮箱登录先得到 `aal1`。应用要求 TOTP 挑战。
5. 挑战成功后，会话提升到 `aal2`，存档和私有上传才可访问。
6. 用户可在 `aal2` 会话中添加第二个备用因子或移除因子。

二维码、TOTP URI 和密钥只在注册步骤显示。应用不得把它们写入日志、数据库、分析
事件或支持工单。

## 数据库门禁

迁移 `phase7_totp_aal2` 为以下对象加入 `AS RESTRICTIVE` 的 opt-in MFA 策略：

- `profiles`
- `game_sessions`
- `game_turn_requests`
- `game_turns`
- `game_checkpoints`
- `user_uploads`
- `storage.objects` 中的 `user-uploads` 桶

策略读取 JWT 的 `aal` 声明，并检查 `auth.mfa_factors`。没有已验证因子的用户可以使用
`aal1` 或 `aal2`。存在已验证因子时只允许 `aal2`。

`create_or_get_game_session`、`reserve_game_turn` 和 `delete_game_session` 原本使用
`SECURITY DEFINER`。仅依赖 RLS 会留下绕过路径。迁移把原实现移动到不可公开执行的
`private` schema，并用执行同一 MFA 检查的 public wrapper 替代。

## 恢复边界

Supabase 不为 TOTP 自动生成恢复码。产品允许最多两个因子，第二个因子应保存在另一台
受控设备。两个因子都丢失时：

1. 用户仍可通过邮箱完成第一因素登录。
2. 会话只能达到 `aal1`，数据库继续拒绝受保护数据。
3. 用户不能自行绕过门禁或用短信恢复。
4. 管理员只能在核验邮箱控制权与账户活动后移除丢失因子。
5. 管理员操作必须留下时间、操作者、目标用户和理由，不记录 TOTP 密钥。

管理员重置界面尚未实现。真实启用验收前，应先确定受控操作流程。当前代码通过建议
备用因子降低这一风险，但不能消除它。

## 验收

- 单元测试覆盖状态判断、注册、验证、错误验证码和因子移除。
- 契约测试确认所有敏感表使用 restrictive 策略，三个 RPC 执行 `mfa_required` 检查。
- Supabase 远端项目必须显示 7 条 restrictive 策略。
- 手工 E2E 必须覆盖注册、退出、邮箱再登录、AAL1 被拒绝、TOTP 后 AAL2 恢复访问。
- 再用第二个用户验证存档和上传仍不能跨用户读取。

2026-07-27，用户报告手工注册、退出、邮箱再登录、AAL1 拒绝与 TOTP 后 AAL2 恢复访问
均通过。自动化双用户隔离测试也已通过。因此能力状态进入 `enabled`。该记录不包含二维码、
密钥或 6 位验证码；远端测试项目偶发的 TLS 清理失败仍属于运维稳定性风险。

## 研究依据（MLA）

- “Multi-Factor Authentication.” *Supabase Docs*, Supabase,
  [supabase.com/docs/guides/auth/auth-mfa](https://supabase.com/docs/guides/auth/auth-mfa).
  Accessed 27 July 2026.
- “Time-based One-Time Password (TOTP) Multi-Factor Authentication.” *Supabase Docs*,
  Supabase,
  [supabase.com/docs/guides/auth/auth-mfa/totp](https://supabase.com/docs/guides/auth/auth-mfa/totp).
  Accessed 27 July 2026.
