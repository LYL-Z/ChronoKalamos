# 阶段 7 验收自检清单

这份清单把“代码已写入”和“可以开启中国大陆真实手机号登录”分开。没有证据的条目不得标记为通过。

| # | 启用证据 | 当前状态 | 验证方法 | 剩余卡点 |
|---|---|---|---|---|
| 1 | 锁定首发国家或地区 | 已锁定 | `GET /api/auth/phone/readiness` 应返回 `CN-mainland` | 香港、澳门、台湾不在本次范围 |
| 2 | 取得短信供应商、沙箱与配额 | 部分完成 | Twilio 控制台显示 Trial、余额 `$14.35`、`ChronoKalamos Login` Verify Service、中国大陆 SMS Fraud Guard 监控 | 试用账号只可向已验证号码发送；正式账号、配额和送达未证实 |
| 3 | 完成发送主体、模板、签名和当地资质审核 | 未完成 | Verify Template Management 需显示已审批的中国大陆模板，并保存资质记录 | 当前页面为 `No custom template`；中国大陆合规、签名和模板证据缺失 |
| 4 | 完成单号、单 IP、设备和项目预算上限 | 代码完成，证据待留 | Supabase `phone_auth_audit` 与 RPC 集成测试；核对 `PHONE_AUTH_DAILY_LIMIT` | 设备级限流和预算告警仍需生产观测接入 |
| 5 | OTP 前 CAPTCHA 与服务端限流 | 代码完成，Cloudflare widget 已创建 | Turnstile siteverify 有效/无效/缺失测试；发送路由审计和 RPC 并发测试；Cloudflare 控制台核对 `ChronoKalamos Phone Auth` Managed widget 与 `chronokalamos.com` 主机名 | 需要在生产凭证齐备后完成一次真实 token 发送演练；Cloudflare API 连接器仍不能作为验证证据 |
| 6 | 换号、回收、SIM swap、恢复规则 | 政策已写入，批准证据待留 | 审核 [`docs/phone-recovery-policy.md`](./phone-recovery-policy.md)；确认邮箱主恢复、人工恢复和安全通知流程 | 真实资质与安全通知尚未验收；手机号不能作为唯一恢复凭证 |
| 7 | 过期 `phone_change` 清理、冲突拒绝、审计 | 代码已完成，实时演练待留 | 应用 `20260727140000_phase7_phone_identity_binding.sql`；检查服务端预检、24 小时清理、唯一约束与审计 | 尚未在隔离项目用真实 OTP 完成双用户绑定 |
| 8 | 隔离项目真实短信端到端测试 | 未完成 | 在独立测试项目完成发送、正确码、错误码、过期码、重复请求和双用户隔离 | 当前 `.env.test` 只有 Supabase URL/publishable key；Twilio 与 Turnstile 沙箱凭证缺失 |

## 代码门禁

- `PHONE_AUTH_PROVIDER` 只接受 `mock` 或 `twilio`，值会去除空白。
- `PHONE_AUTH_ENABLED=false` 时，发送和校验端点统一返回 503，不访问 Twilio。
- 只有 `PHONE_AUTH_ENABLED=true`、`PHONE_AUTH_PROVIDER=twilio`、`PHONE_AUTH_POLICY_VERIFIED=true`、全部服务端密钥存在时，才允许真实调用。
- 手机号和 IP 不以明文写入审计表；数据库保存带服务端盐的 SHA-256 与号码掩码。
- `phone_auth_audit` 启用 RLS，匿名和普通认证角色没有表或函数权限。
- Turnstile 令牌只在服务端向 Cloudflare `siteverify` 提交，并按 action 和可选 hostname 校验。
- 每个请求可带 UUID `requestId`；重复 UUID 不会重复调用供应商。
- 日额度只统计已获得供应商调用资格的请求；手机号/IP/日额度拒绝不会消耗 Twilio 预算。
- Cloudflare 已创建 Managed widget `ChronoKalamos Phone Auth`，绑定 `chronokalamos.com`；
  site key 只通过 Sites 公开环境变量注入，secret 只通过 Sites secret 环境变量注入。

## GitHub 连接状态

`LYL-Z/ChronoKalamos` 为私有仓库。本分支必须推送到 `codex/**`，这样现有 CI
工作流才会触发。GitHub 连接器对该私有仓库返回 404 时，仍以 `git ls-remote`
和 Actions 页面为证据，不以连接器 404 推断仓库不存在。推送后记录 commit SHA
和 CI 运行链接：

```text
git push -u github codex/phase7-phone-identity
```

推送成功后再把该命令输出的 commit SHA 与 CI 运行链接填回本清单。

## 生产开启前的最后命令

```text
npm run lint
npx tsc --noEmit
npm test
npm run test:supabase:live
```

四条命令和上表 8 项证据必须同时通过。部署成功本身不构成历史、合规或短信送达验证。
