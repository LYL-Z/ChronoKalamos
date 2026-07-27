# 阶段 7：身份能力接入门禁

## 当前唯一轨道

当前只评估“邮箱 + TOTP”。该方案使用 Supabase Auth 内置 MFA，不依赖短信供应商，
不增加按次发送成本。能力状态为 `evaluating`。短信与手机号登录、Passkey、微信、
QQ、真实打赏和第二历史场景均为 `not_started`。

代码中的 [`lib/capabilities/phase7.ts`](../lib/capabilities/phase7.ts) 是机器可检查的门禁。
任何能力只有在全部 gate 标为 `verified` 且附带证据后，才可进入 `ready` 或
`enabled`。同时推进的能力不得超过一个。

## TOTP 启用证据

以下证据缺一不可：

1. TOTP 只向已确认邮箱的正式账户开放。
2. 注册返回的二维码和密钥不写入日志、数据库或分析事件。
3. 登录挑战成功后会话达到 `aal2`。
4. 敏感表和私有桶存在 restrictive MFA 策略。
5. owner-scoped `SECURITY DEFINER` RPC 不能绕过 MFA。
6. 用户可配置第二个备用因子。
7. 丢失全部因子时，邮箱登录不能绕过 AAL2；管理员重置有审计边界。
8. 真实身份验证器完成注册、退出、再次登录与双用户隔离验收。

前七项已有代码或远端数据库证据。第八项仍需用户持有的身份验证器参与。因此当前不能
把 TOTP 写成“全面验收完成”。

## 暂缓的短信路线

原有 Twilio Verify、Cloudflare Turnstile、限流和审计代码继续保留，但不进入公开
身份面板。环境默认值固定为：

```text
PHONE_AUTH_PROVIDER=mock
PHONE_AUTH_ENABLED=false
PHONE_AUTH_POLICY_VERIFIED=false
```

该准备层不构成中国大陆短信资质、模板审批或真实送达证据。若未来恢复短信工作，必须
重新核对发送资质、费用、号码回收、SIM swap、CAPTCHA 和隔离项目投递。历史风险记录见
[`docs/phone-recovery-policy.md`](./phone-recovery-policy.md)。

## Passkey 与其他能力

- Passkey：暂不实现。不能把平台支持推断为已完成跨浏览器、跨设备和恢复测试。
- 微信与 QQ：先取得开放平台审批、回调域名和正式应用标识。
- 真实打赏：先完成商户资质、退款、税务、未成年人和隐私文本。
- 第二历史场景：必须复用
  [`docs/scenario-expansion-template.md`](./scenario-expansion-template.md)。

## 研究依据（MLA）

- “Multi-Factor Authentication.” *Supabase Docs*, Supabase,
  [supabase.com/docs/guides/auth/auth-mfa](https://supabase.com/docs/guides/auth/auth-mfa).
  Accessed 27 July 2026.
- “Time-based One-Time Password (TOTP) Multi-Factor Authentication.” *Supabase Docs*,
  Supabase,
  [supabase.com/docs/guides/auth/auth-mfa/totp](https://supabase.com/docs/guides/auth/auth-mfa/totp).
  Accessed 27 July 2026.
