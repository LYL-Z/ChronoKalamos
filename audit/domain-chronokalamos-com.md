# `chronokalamos.com` 域名绑定记录

日期：2026-07-25

## 结果

`chronokalamos.com` 已绑定到 ChronoKalamos Sites 项目，并完成 SSL 配置。

- Sites 状态：`active`
- provider 状态：`active`
- SSL 状态：`active`
- Sites CNAME 目标：`custom-domains.chatgpt.site.`
- 根域名 A 记录：`162.159.143.30`、`172.66.3.26`

## DNS 记录

DNSPod 中保留以下记录：

| 主机记录 | 类型 | 值 |
| --- | --- | --- |
| `@` | A | `162.159.143.30` |
| `@` | A | `172.66.3.26` |
| `_openai-site-verification` | TXT | Sites 当前生成的验证值 |
| `_cf-custom-hostname` | TXT | Sites 当前生成的 Cloudflare 主机验证值 |

主机记录必须填写相对名称。将完整 FQDN 填入 DNSPod 的主机记录字段会被自动追加一次域名，导致重复域名。

## 验证

- 权威 DNS 已返回两个验证 TXT。
- 公共 DNS 已返回 `_cf-custom-hostname`，OpenAI TXT 在递归缓存过期后收敛。
- `https://chronokalamos.com` 返回 HTTP 200。
- Sites 刷新验证后返回 `status: active`、`provider_status: active`、`ssl_status: active`。

站点内容仍由生产 Sites 版本提供。域名绑定不改变 Supabase、邮箱登录或阶段 4 内容权限。
