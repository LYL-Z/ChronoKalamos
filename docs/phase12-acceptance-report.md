# 阶段12验收报告

验收日期：2026-07-29
内容版本：11.0.0
界面版本：12.0
历史审阅：`pending`

## 交付范围

| 项目 | 状态 | 证据 |
|---|---|---|
| 历史存档页 | 已实现 | `/saves` 读取当前身份经 RLS 可见的 `game_sessions`；无演示替代数据 |
| 个人设置页 | 已实现 | `/settings` 提供低动态、文字大小和五语状态 |
| 支持说明页 | 已实现 | `/support` 提供健康检查、能力边界和最小诊断摘要 |
| 证据地图 | 已实现 | 年份、来源、证据等级、不确定性、当前事件高亮 |
| 章节时间轴 | 已实现 | 从事件目录、当前事件、完成事件和回合状态派生 |
| 错误恢复 | 已实现 | 证据重试、离线提示、同一 `clientTurnId` 回合重试 |
| 空状态 | 已实现 | 未配置、未登录、无存档、加载、错误和无筛选结果 |
| 回合回顾 | 保持并联动 | 已提交摘要、状态差异、关系记忆和章节进度 |
| 多语边界 | 已实现 | 法、希、俄明确标为“仅界面翻译” |

## 自动验证

Phase 12 adds 14 Playwright checks. They cover four routes with axe, keyboard navigation, 390 px and 768 px breakpoints, font loading, evidence filters, offline state, product states, and a performance budget.

The release gate remains:

```text
npm run lint
npx tsc --noEmit
npm test
npm run test:supabase:live
```

`npm audit --omit=dev` must report zero production vulnerabilities. Development-only audit findings are recorded for Phase 13; forced breaking downgrades are prohibited.

## Claims not made

- Automated axe checks do not prove full WCAG conformance.
- A successful build does not validate historical claims.
- Provisional Phase 11 locations are not promoted to published database records.
- External historian certification remains pending.
