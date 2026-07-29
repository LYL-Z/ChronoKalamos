# Phase 13 验收报告

> 日期：2026-07-29
> 状态：代码与 Supabase 迁移已完成；公开 Sites 版本待用户确认后部署。

## 已验证

| 项目 | 结果 | 证据 |
|---|---|---|
| 本地/远程迁移 | 通过 | 27 份逐项同名；migration lock |
| RLS 与跨用户隔离 | 通过 | 真实 Supabase live suite |
| 私有 Storage | 通过 | 私有桶、5 MiB、三种 MIME、跨用户下载/删除拒绝 |
| 删除流程 | 通过 | 所有者删除；外部用户删除拒绝；测试清理 |
| `phone_auth_audit` | 通过 | restrictive deny；仅 service role |
| 浏览器业务 RPC | 通过 | invoker wrapper；owner/AAL2 受控实现 |
| service-role definer | 通过 | 空 search path；ACL 仅 service role |
| AI 日额度 | 通过 | 40/500 默认；并发锁；重复调用拒绝 |
| 隐私日志 | 通过 | 结构化最小字段；用户摘要；无输入正文 |
| CSP 与公开响应头 | 通过 | 生产 HTTPS 现场响应 |
| DNS 与 Cloudflare 代理 | 通过 | active zone；proxied A；CF-Ray |
| GitHub Actions 门禁 | 代码完成 | secret scan、migration、完整测试、live RLS、liveness |
| 健康检查 | 本地完成 | liveness + Supabase readiness |
| 回滚说明 | 完成 | 应用回滚、向前数据库修复、密钥事件 |

## 未关闭

1. 泄露密码保护仍关闭。Supabase Free 计划不提供该能力。
2. 八条匿名访问 Advisor 警告仍存在。它们来自游客产品路径，不是跨用户开放策略。
3. Cloudflare TLS 模式、最低 TLS、WAF entrypoint、rate limiting、Turnstile 与 Analytics
   因 API token 权限不足无法核验。
4. 新的 `/api/ready` 与 AI 额度代码尚未部署到公开站。
5. 30 天 liveness SLO 尚无观测窗口，不能宣布达标。

## 发布判定

阶段 13 代码候选可进入 CI 与公开部署审批。只有 CI 两个核心 job 通过、Sites 候选版本
保存、公开部署获确认、部署后 `/api/ready` 返回 200，才能把 Phase 13 标为公开完成。
