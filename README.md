# ChronoKalamos

ChronoKalamos／ΧΡΟΝΟΚΑΛΑΜΟΣ 是一款有史料边界的 AI 历史人生模拟器。首发切片锁定公元742年的唐代长安，地图与时间轴是主要入口。

## 当前边界

- 一座城市：长安；一个年份：742；三种有限出身模板。
- 界面提供中文、英文、法文、希腊文和俄文骨架。
- 中文历史内容是首发审校语言。法、希、俄暂不宣称历史译文已审校。
- 当前页面是前端原型。AI回合、真实历史地图、支付、微信、QQ和手机号登录不在0～3阶段。
- 地图图形是原型图层，不是742年长安的考证复原。

## 阶段状态

阶段0～2的文档、视觉原型、低动态模式、五语界面骨架和前端流程已落地。阶段3的 Supabase 客户端、RLS 迁移、游客升级、幂等存档和私有上传已落地，但双用户云端隔离测试必须在真实 Supabase 项目上运行后，阶段3才算退出。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

未配置 Supabase 时，界面会明确显示“Supabase 未配置”，游客入口只打开开发模拟器，不会制造虚假的可恢复账户。

## Supabase 配置

复制 `.env.example`，设置：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

然后在 Supabase SQL Editor 或迁移工具中执行 `supabase/migrations/202607180001_phase3_identity_saves.sql`。项目还必须开启匿名登录、手动身份关联，并把当前站点加入邮箱重定向白名单。不要把 service-role key 放进浏览器环境。

## 验证

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:supabase:live
```

最后一项需要 `SUPABASE_TEST_URL` 和 `SUPABASE_TEST_PUBLISHABLE_KEY`。没有它们时测试会跳过；跳过不等于通过。

## 文档入口

- `docs/product-brief.md`：产品边界与可验收目标。
- `docs/implementation-plan.md`：阶段退出条件和阻塞状态。
- `docs/brand-and-ui.md`、`docs/motion-spec.md`、`docs/i18n-copy.md`：视觉、动效和翻译边界。
- `docs/data-model.md`、`docs/auth.md`、`docs/security-privacy.md`：阶段3身份和数据边界。
