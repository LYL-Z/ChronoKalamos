# ChronoKalamos

ChronoKalamos／ΧΡΟΝΟΚΑΛΑΜΟΣ 是有史料边界的 AI 历史人生模拟器。首发切片锁定公元 742 年的唐代长安，地图与时间轴是主要入口。

## 当前边界

- 三种出身：西市粟特商户家庭后辈、长安工匠家庭学徒、京兆基层吏员家庭成员。
- 界面准备中文、英文、法文、希腊文和俄文；史实内容首发只承诺人工审校的中英文。
- AI 回合、真实历史地图、支付、微信、QQ 和手机号登录尚未接入。
- 动态效果支持 `prefers-reduced-motion` 和产品内低动态模式。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

未配置 Supabase 时，界面明确显示“Supabase 未配置”，游客入口只打开开发模拟器，不制造虚假的可恢复账户。

## Supabase 配置

生产浏览器变量：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

真实集成测试变量放在被忽略的 `.env.test`：

```text
SUPABASE_TEST_URL=
SUPABASE_TEST_PUBLISHABLE_KEY=
```

测试项目需要启用匿名登录、手动身份关联，并把生产站和本地地址加入重定向白名单。邮箱确认在正式配置中保持开启。不要把 service-role key 放进浏览器环境。

## 验证

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:supabase:live
```

最后一项会创建两个真实匿名用户，验证存档和私有上传隔离，再验证游客 UUID 连续性。它会清理业务数据和带专用 metadata 的测试用户。缺少 `.env.test` 时测试会跳过；跳过不等于通过。

## 文档入口

- `docs/product-brief.md`：产品边界与验收目标。
- `docs/implementation-plan.md`：阶段状态、实测证据与剩余风险。
- `docs/brand-and-ui.md`、`docs/motion-spec.md`、`docs/i18n-copy.md`：视觉、动效和翻译边界。
- `docs/data-model.md`、`docs/auth.md`、`docs/security-privacy.md`：身份、数据与隐私约束。
