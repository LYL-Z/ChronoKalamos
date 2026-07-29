# ChronoKalamos 可观测性与错误预算

## 信号边界

本项目只记录运行所需的最小信号。日志不得包含输入正文、叙事正文、邮箱、手机号、IP、
Authorization、Cookie、Supabase JWT、DeepSeek 响应正文或任何密钥。

允许的应用安全日志字段：

- 时间；
- 服务名；
- 事件名；
- 结果；
- 内部请求 ID；
- 短错误码；
- 可选的用户 UUID 摘要。

允许的 AI 数据库审计字段见 `docs/security-hardening-v2.md`。这些数据用于成本核对、错误
预算和事故调查，不用于用户画像。

## SLO 与预算

以下是 Phase 13 的运行目标，不是历史达成值：

| 指标 | 窗口 | 目标 | 错误预算 |
|---|---:|---:|---:|
| 公共站点 liveness | 30 天 | 99.5% | 216 分钟 |
| Supabase 内容 readiness | 30 天 | 99.0% | 432 分钟 |
| 已受理 AI 尝试成功率 | 7 天 | 97.0% | 3.0% |
| 回合事务重复提交 | 每次发布 | 0 | 0 |
| 跨用户读取或删除 | 每次发布 | 0 | 0 |

AI 成功率分母是已写入 `ai_call_audit` 的完成尝试。`success` 为成功。模型失败、超时、
拒绝、图片不支持、验证失败和异常均消耗错误预算。用户主动触发的内容阻断和额度拒绝发生
在供应商调用之前，不进入分母。

少于 20 次尝试时，样本只报告，不用于宣布达标。命令如下：

```powershell
npm run observability:error-budget
```

## 健康检查

- `/api/health`：进程 liveness。不得访问数据库，也不得泄露配置。
- `/api/ready`：查询一条已发布的 `tang-changan-742` manifest。超时、缺键或响应异常时
  返回 503。

生产检查：

```powershell
npm run health:production
$env:CHECK_READINESS='true'
npm run health:production
Remove-Item Env:CHECK_READINESS
```

GitHub Actions 在受保护分支 push 后检查公共 liveness。持续 30 天的可用率尚无已核验
监控后端。因此 99.5% 只能作为目标，不能写成已达到。

## 事故阈值

立即设置 `AI_TURNS_ENABLED=false` 的条件：

- 全站日调用接近 500；
- 7 天 AI 错误预算消耗超过 100%；
- DeepSeek 出现持续超时或异常计费；
- 状态校验出现绕过迹象；
- 审计写入在供应商调用前失败。

回合状态提交仍由数据库事务决定。关闭 AI 不删除存档，也不改变历史内容。

## 保留与清理

AI 调用审计默认保留 30 天：

```powershell
npm run maintenance:ai-audit
```

清理 RPC 拒绝短于 7 天的保留期。停留超过一小时的 `reserved` 记录先标为
`abandoned`，再按截止时间清理。Cloudflare Analytics 的启用状态尚未核验；在控制台
确认数据字段和保留期前，不把它纳入产品指标。
