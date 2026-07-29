# ChronoKalamos 部署、健康检查与回滚 v2

## 发布门禁

发布候选必须通过：

```powershell
npm run security:scan
npm run db:migrations:verify
npm run content:validate
npm run content:validate:phase11
npm run lint
npm run typecheck
npm run build
npm run test:production-smoke
npm run test:unit
npm run test:contracts
npm run test:e2e
npm run test:supabase:live
npm audit --omit=dev --audit-level=high
```

GitHub Actions 的 `supabase-live` job 必须配置：

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_PUBLISHABLE_KEY`
- `SUPABASE_TEST_SECRET_KEY`

缺少任一值时 job 失败，不能把测试跳过当作通过。

## 部署顺序

1. 记录当前生产 Sites 版本和 Git commit。
2. 对 Supabase 执行 migration dry-run。
3. 只应用 dry-run 列出的新迁移。
4. 重新运行 Security Advisor 与 live RLS 测试。
5. 构建并保存 Sites 候选版本。
6. 获得公开部署确认。
7. 部署候选版本。
8. 检查 `/api/health` 与 `/api/ready`。
9. 完成游客、邮箱、TOTP、存档和三回合冒烟测试。

`APP_RELEASE` 应设置为发布 commit SHA。它是公开标识，不是密钥。

## 回滚

### 应用回滚

1. 立即设置 `AI_TURNS_ENABLED=false`，阻止新模型调用。
2. 在 Sites 部署上一个已知健康版本。
3. 检查 `/api/health`。
4. 检查最近一次存档读取。
5. 记录失败版本、时间和错误码。

### 数据库回滚

数据库迁移采用向前修复。不要直接删除 Phase 13 表或函数。旧应用不依赖
`ai_call_audit`，因此应用版本可以先回滚，新增数据库对象可保留。

若 Phase 13 RPC 本身存在缺陷：

1. 保持 `AI_TURNS_ENABLED=false`。
2. 新建后续迁移修复函数。
3. 不修改 `supabase_migrations.schema_migrations`。
4. 通过 service-role contract 和 live 测试后再恢复 AI。

### 密钥事件

若服务端密钥可能泄露：

1. 禁止公开部署。
2. 在供应商控制台轮换密钥。
3. 更新 Sites 与 GitHub Secrets。
4. 运行 tracked-secret scan。
5. 检查 Supabase 与 Cloudflare 审计日志。
6. 重新部署。不得把旧密钥写入 issue、PR 或聊天。

## Cloudflare 外部控制台待办

API 已确认 zone 为 active、DNS 由 Cloudflare 托管、根域 A 记录处于代理状态。公共检查
确认 HTTP 跳转 HTTPS，HTTPS 返回 200，并带 HSTS、CSP 和 `CF-Ray`。

当前连接器对以下读取返回 9109、10000 或 `request is not authorized`。因此它们尚未核验：

- SSL 模式是否为 Full (strict)；
- Minimum TLS 是否为 1.2 或以上；
- TLS 1.3；
- WAF managed entrypoint 是否启用；
- 自定义 WAF 规则；
- Cloudflare rate limiting；
- Turnstile widget、hostname 与密钥轮换；
- Web Analytics / RUM。

账号所有者需在控制台核对这些开关，或向连接器授予对应只读 token。Cloudflare 建议在
条件允许时使用 Full (strict)，因为该模式验证源站证书。

## 依据

- Cloudflare. “Full (Strict).” *Cloudflare Docs*, 2026,
  <https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/>.
- Cloudflare. “Server-Side Validation.” *Cloudflare Turnstile Docs*, 2026,
  <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>.
- Cloudflare. “WAF.” *Cloudflare Docs*, 2026,
  <https://developers.cloudflare.com/waf/>.
