# 阶段14发布与评估清单

## 自动门禁

- [ ] `npm run security:scan`
- [ ] `npm run db:migrations:verify`
- [ ] `npm run content:validate`
- [ ] `npm run content:validate:phase11`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:unit`
- [ ] `npm run test:contracts`
- [ ] `npm run test:e2e`
- [ ] `npm run test:supabase:live`
- [ ] Supabase Advisors 已复核
- [ ] Sites 候选版本已保存，可回滚到版本 35
- [ ] 生产 `/api/health` 与 `/api/ready` 返回成功

## 数据与伦理

- [ ] `/playtest` 明示自愿、游客风险、字段、保留期和删除方式
- [ ] 未经同意的行为不进入测试表
- [ ] 退出后同意记录与关联事件均删除
- [ ] 数据表没有自由文本、直接身份、IP 或设备指纹列
- [ ] 分支输出对少于 3 人的单元执行抑制

## 外部证据

- [ ] 8—20 名真实参与者完成自愿同意
- [ ] 三种出身线各至少 2 人
- [ ] 至少一名历史审阅者身份与决定可核验
- [ ] 不存在未处理的阻断性审阅意见

外部证据未齐时，只能发布“正在收集证据”的公开测试版，不能宣布商业级完成。

