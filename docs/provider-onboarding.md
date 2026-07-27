# 阶段 7：外部能力接入门禁

## 当前唯一轨道

本轮只评估手机号登录。微信、QQ、真实打赏和第二历史场景均保持 `not_started`。
手机号登录当前为 `evaluating`，不是 `ready`，更不是 `enabled`。公开站不得出现可提交
手机号或验证码的入口。

## 为什么不能直接开启

Supabase 托管项目的手机号 OTP 需要单独启用 Phone Auth，并配置短信供应商。官方原生
列表包括 MessageBird、Twilio 和 Vonage；TextLocal 属于社区支持。官方同时要求控制
短信费用、设置速率限制与 CAPTCHA，并核对实际运营国家的短信法规。

游客升级还存在独立风险。匿名用户可以通过 `updateUser({ phone })` 绑定电话身份，但
2026 年 7 月的 Supabase 故障说明指出，多个未完成验证记录可能留下相同的
`phone_change`。验证过程若按该字段查找，可能把号码更新到错误用户。未建立过期记录
清理、唯一性冲突检测和失败恢复前，不得把手机号升级路径投入生产。

## 启用证据

以下八项必须全部完成，并为每项保存可复核证据：

1. 锁定首发国家或地区。不得用“全球”代替可执行的合规范围。
2. 选定短信供应商，取得正式账号、沙箱和发送配额。
3. 完成发送主体、短信模板、签名和当地资质审核。
4. 设定单用户、单 IP、单设备和全项目预算上限；达到阈值后自动停发。
5. 在发送 OTP 前启用 CAPTCHA，并验证服务端速率限制。
6. 写明换号、号码回收、SIM swap 和账号恢复规则。
7. 实现过期 `phone_change` 清理、冲突拒绝和审计记录。
8. 在隔离项目完成真实短信端到端测试。

代码中的 [`lib/capabilities/phase7.ts`](../lib/capabilities/phase7.ts) 是机器可检查的门禁。
任何能力只有在全部 gate 标为 `verified` 且附带证据后，才允许进入 `ready` 或
`enabled`。同时处于评估或启用状态的能力不得超过一个。

## 身份与存档验收

手机号轨道至少覆盖以下用例：

- 游客先建立存档，再绑定手机号；验证前后 `auth.users.id` 保持不变。
- 退出后以手机号重新登录，原存档和私有图片仍可读取。
- 第二个手机号用户不能读取第一个用户的存档、回合、检查点或上传。
- 已属于其他用户的手机号必须拒绝绑定，不自动合并账号。
- 重复发送、错误验证码、过期验证码、并发验证和超出预算均有明确失败结果。
- 废弃的 `phone_change` 在宽限期后被清理，并留下不含完整手机号的审计记录。
- 手机号不能作为未经风险评估的唯一恢复凭证。

## 其他能力的后续入口

- 微信与 QQ：先取得开放平台审批、回调域名和正式应用标识，再评估自定义 OAuth/OIDC
  或服务端交换方案。Supabase 当前原生社交供应商列表不包含微信或 QQ。
- 真实打赏：先完成商户资质、目标地区、退款、税务、未成年人和隐私文本。测试支付不得
  冒充真实付款。
- 第二历史场景：必须复用
  [`docs/scenario-expansion-template.md`](./scenario-expansion-template.md)，并单独通过史料
  与许可门禁。

## 研究依据（MLA）

- “Anonymous Sign-Ins.” *Supabase Docs*, Supabase,
  [supabase.com/docs/guides/auth/auth-anonymous](https://supabase.com/docs/guides/auth/auth-anonymous).
  Accessed 27 July 2026.
- “Phone Login.” *Supabase Docs*, Supabase,
  [supabase.com/docs/guides/auth/phone-login](https://supabase.com/docs/guides/auth/phone-login).
  Accessed 27 July 2026.
- “Unexpected Behavior with `auth.updateUser({ phone })`.” *Supabase Docs*, Supabase,
  [supabase.com/docs/guides/troubleshooting/unexpected-behavior-with-authupdateuser-phone-phone-linked-to-incorrect-user-id-45368f](https://supabase.com/docs/guides/troubleshooting/unexpected-behavior-with-authupdateuser-phone-phone-linked-to-incorrect-user-id-45368f).
  Accessed 27 July 2026.
