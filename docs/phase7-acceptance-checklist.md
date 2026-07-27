# 阶段 7 验收自检清单

这份清单把“代码已写入”和“可以开启中国大陆真实手机号登录”分开。没有证据的条目不得标记为通过。

| # | 启用证据 | 当前状态 | 验证方法 | 剩余卡点 |
|---|---|---|---|---|
| 1 | 锁定首发国家或地区 | 已锁定 | `GET /api/auth/phone/readiness` 应返回 `CN-mainland` | 香港、澳门、台湾不在本次范围 |
| 2 | 取得短信供应商、沙箱与配额 | 部分完成 | Twilio 控制台核对 Verify Service、试用目的号码、账户余额与地理权限 | 试用账号只可向已验证号码发送；中国大陆送达与正式配额未证实 |
| 3 | 完成发送主体、模板、签名和当地资质审核 | 未完成 | 保存供应商、运营商和当地合规审核记录 | 中国大陆短信合规、签名和模板证据缺失 |
| 4 | 完成单号、单 IP、设备和项目预算上限 | 代码完成，证据待留 | Supabase `phone_auth_audit` 与 RPC 集成测试；核对 `PHONE_AUTH_DAILY_LIMIT` | 设备级限流和预算告警仍需生产观测接入 |
| 5 | OTP 前 CAPTCHA 与服务端限流 | 代码完成，凭证待留 | Turnstile siteverify 有效/无效/缺失测试；发送路由审计和 RPC 并发测试 | Cloudflare API 当前返回 10000 Authentication error，生产 widget/sitekey 未核验 |
| 6 | 换号、回收、SIM swap、恢复规则 | 未完成 | 审核 `docs/provider-onboarding.md` 中的恢复政策并保留批准记录 | 尚未接入 Supabase phone identity 绑定，不得把手机号当唯一恢复凭证 |
| 7 | 过期 `phone_change` 清理、冲突拒绝、审计 | 部分完成 | 运行清理作业演练；检查审计只含 hash 与掩码 | 真实 Supabase Auth 手机绑定流程仍未启用 |
| 8 | 隔离项目真实短信端到端测试 | 未完成 | 在独立测试项目完成发送、正确码、错误码、过期码、重复请求和双用户隔离 | 当前 `.env.test` 只有 Supabase URL/publishable key；Twilio 与 Turnstile 沙箱凭证缺失 |

## 代码门禁

- `PHONE_AUTH_PROVIDER` 只接受 `mock` 或 `twilio`，值会去除空白。
- `PHONE_AUTH_ENABLED=false` 时，发送和校验端点统一返回 503，不访问 Twilio。
- 只有 `PHONE_AUTH_ENABLED=true`、`PHONE_AUTH_PROVIDER=twilio`、`PHONE_AUTH_POLICY_VERIFIED=true`、全部服务端密钥存在时，才允许真实调用。
- 手机号和 IP 不以明文写入审计表；数据库保存带服务端盐的 SHA-256 与号码掩码。
- `phone_auth_audit` 启用 RLS，匿名和普通认证角色没有表或函数权限。
- Turnstile 令牌只在服务端向 Cloudflare `siteverify` 提交，并按 action 和可选 hostname 校验。
- 每个请求可带 UUID `requestId`；重复 UUID 不会重复调用供应商。

## GitHub 连接状态

`LYL-Z/ChronoKalamos` 私有仓库已在已登录 GitHub 账户中创建，本地工作树已添加
`github` 远端。当前环境没有 `gh` CLI，且 GitHub 连接器对该私有仓库返回 404，
因此本阶段不能声称源码已推送到 GitHub。使用拥有该仓库写权限的 GitHub 凭证后，
执行：

```text
git push -u github agent/phase7-phone-auth-guardrails
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
