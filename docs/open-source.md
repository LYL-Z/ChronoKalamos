# ChronoKalamos 开源说明：迭代、创新与复现

本文说明软件从第 0 版到当前小规模公开测试版的路径、真正可复用的创新，以及如何在本机复现这些机制。它不是史学认证，也不是第二座城的开发手册。

当前对外版本：`SMALL PUBLIC BETA`。运行时身份来自 `lib/playtest/release.json`（`appRelease` 40，`contentVersion` 11.0.0）。`PHASE 11 · PUBLIC BETA` 只表示内容未经外部史家认证。

## 产品是什么

ChronoKalamos 是有史料边界的 AI 历史人生模拟器。首发切片只覆盖公元 742 年长安、三种出身、约十分钟一次人生。

机制可以概括为两句话：

1. **权威存档回路**：浏览器不能写世界状态；回合与天下事务只经服务端规则校验后由 `service_role` RPC 原子提交。
2. **三级史料标签**：界面必须区分 `史料记载`、`合理重建`、`叙事虚构`。模型只表达当前事件，不得发明世界事实，也不得把连接句写成史料。

明确不做：第二历史场景、支付、短信、微信、QQ、Passkey、伪造学者认证、把示意地图升级成 742 GIS、把 50 个组合结局宣传成 50 段写好的人生。

## 从 0 到现在

| 阶段 | 做成了什么 | 诚实边界 |
| --- | --- | --- |
| 0 | 锁定一城一年三出身；史料标签、许可红线、架构可检查 | 范围不是全球史 |
| 1 | Sand & Cinnabar：砂纸、朱砂、靛蓝、黄铜 | 不换通用紫蓝 SaaS |
| 2 | 启动、身份入口、地图时间轴、低动态、移动降级 | 原型不等于权威存档 |
| 3 | Supabase Auth、RLS、游客升级、私有上传、双用户隔离 | 游客不能暗示跨设备恢复 |
| 4 | 已发布主张、出身、地图证据点进入只读表 | CHGIS/CBDB 只作红线，不入库 |
| 5 | 规则引擎、DeepSeek 适配、SSE、Zod 契约、服务端提交 | 无密钥时只返回「本回合未提交」 |
| 6 | 安全头、请求上限、限流、健康检查、生产 smoke | CSP 仍含 `unsafe-inline`（RSC 需要）；泄露密码保护受 Free 计划限制 |
| 7 | 邮箱 + 自愿 TOTP，AAL2 门禁 | 短信、手机号、Passkey 关闭 |
| 8–9 | 能力台账；有限角色设定；十分钟上手 | 图片叙事标筹备中 |
| 10 | 编辑事件决定状态变化；关系记忆、风险时钟、回顾 | 模型输出是表达，不是写库 |
| 11 | 27 事件、12 NPC、内容台账公开为 provisional | 公开可玩 ≠ 史实获批 |
| 12 | 存档 / 设置 / 支持真实路由；axe A/AA；390px 无横溢 | 游戏壳当时未完整纳入设备门 |
| 13 | 迁移、RPC、Storage、回滚与生产硬化 | 控制台限制项持续记录 |
| 14 | 自愿、版本绑定、隐私安全的公开测试遥测 | 参与者与史家审阅未达商业门槛 |
| 15 | 一日三行动、七档案模块、阶层边界 | 不提供任官或帝王玩法 |
| 16 | 图鉴、成就、旬目标由权威状态派生 | 快捷键只聚焦，不提交 |
| 17 | 天下制度工作台：阶层、坊市、十五道、目录、结局 | 108 坊是索引目标；200 SKU / 50 结局是组合生成 |
| 18 | 权威事务：时间、状态版本、存档点一次提交 | 失败不写库；幂等 `clientActionId` |
| 对标硬化 | 见下一节 | 仍停在 742 长安 |

对标硬化（对照故宫数字展、大英博物馆藏品页、Discovery Tour、Inkle、Paradox HUD，而不是对照普通独立游戏原型）补上了这些工程缺口：

- **诚实**：playtest `app_release` 与 SQL CHECK 对齐；`html.lang` 保持 `zh-CN`；图片入口不再伪装可用；已发布地图点按 5 个计数；对外只留 `SMALL PUBLIC BETA`。
- **十分钟人生**：27 事件都有电影板；提交后镜头与旁白同拍；商户开局一个选择改到金光门；游戏态恢复 status；空格不再禁止滚动。
- **可读**：正文字号改 rem，「较大」真正放大；首页第一屏只留年份与地点检索。
- **运维条**：跨文件不变量测试、上传魔数、4xx 仍解析 SSE 失败帧、游戏壳 390 / 200% / forced-colors。
- **顶栏减轨**：游戏主操作保留证据、图鉴、天下、存档、退出；成就、设置、查找、低动态收入「更多」。C / A / W / Ctrl+K 快捷键不变。

## 核心创新（可复现，不是口号）

### 1. 权威存档，而不是「LLM 写世界」

常见历史 RPG 把模型输出直接当成世界。ChronoKalamos 把模型关在表达层：

1. 客户端用 `clientTurnId` 预留或重试同一回合。
2. 服务端用编辑事件目录与规则引擎算出状态差。
3. DeepSeek 只生成符合 Zod 契约的旁白与选项措辞。
4. `service_role` RPC 原子写入回合、状态版本和检查点。
5. 任何失败路径必须让用户看到「本回合未提交」，世界版本不变。

入口：`lib/game/workflow.ts`、`lib/game/rules.ts`、`app/api/game-sessions/[sessionId]/turns/route.ts`、`lib/game/phase18-authority.ts`。

### 2. 三级史料进入 UI，而不是页脚免责声明

每个已发布主张、出身和地点都带分类。生成散文不得标成 `史料记载`。内容闸门拒绝「无来源的史料/重建」。

入口：`docs/historical-method.md`、`lib/historical/content.ts`、`scripts/validate-phase4-content.mjs`、`scripts/validate-phase11-production.mjs`。

### 3. 许可红线先于内容欲望

CHGIS、CBDB 明确不可商业再分发或存在独家授权。项目只保留书目与红线，不把人物库或测绘图拷进游戏。

入口：`docs/data-licenses.md`。

### 4. 身份与权限分层

- 游客：浏览器可丢数据，不得暗示跨设备恢复。
- 邮箱账户：RLS 以 `auth.uid()` 为边界。
- TOTP：自愿；启用后未达 AAL2 不能读受保护数据。
- 客户端永远拿不到 service role、模型密钥或源提示词。

入口：`docs/auth.md`、`docs/totp-mfa.md`、`supabase/migrations/`。

### 5. 版本与发布身份是单一事实源

`lib/playtest/release.json` 驱动配置、清理脚本、live 测试和最新 playtest CHECK。契约不再手写 `36` / `40`。

入口：`lib/playtest/invariants.test.ts`、`supabase/migrations/20260911120000_phase14_playtest_release_40.sql`。

## 复现方法

需要 Node.js `>=22.13.0`。不要把 `.env` 或 service role 提交进 Git。

### A. 无后端：复现界面与内容闸门

```bash
npm install
npm run content:validate
npm run content:validate:phase11
npm run test:unit
npm run test:contracts
npm run dev
```

此时首页应显示「Supabase 未配置」。游客入口只打开开发模拟器，不创建可恢复账户。这复现的是**诚实降级**，不是权威存档。

### B. 复现史料闸门

```bash
npm run content:validate
npm run content:validate:phase11
```

应看到：已发布主张 13、已发布地图 5、出身 3；`史料记载` / `合理重建` 必须带 `sourceIds`；未发布地点不得进入默认图层。

### C. 复现权威回合（需要你自己的 Supabase 与 DeepSeek）

1. 配置 `.env` / `.env.test`，只把 publishable key 放进 `NEXT_PUBLIC_*`。
2. 按 `supabase/migrations/` 顺序应用到测试项目；最新 playtest CHECK 必须读 `release.json` 的 `appRelease`。
3. 启用匿名登录；正式账户可再开 TOTP。
4. 运行：

```bash
npm run test:supabase:live
npm run test:deepseek:production
```

通过标准：同一 `clientTurnId` 重放不二次计费模型；失败回合 `state_version` 不变；SSE 即使 HTTP 4xx 也要能读到 `turn.failed`。

相关单测：`lib/game/client.test.ts`、`lib/game/workflow.test.ts`、`lib/game/narrative.test.ts`。

### D. 复现「选择改变下一可见节拍」

商户开局 `choice-2` 把地点改到金光门（`jin-guang-gate` / M-002），总章仍汇合。不要为此再加第 10 个章节事件。

入口：`lib/game/phase11-catalog.ts`、`components/evidence-map.tsx` 的 `currentLocationId`、契约 `tests/archive-chrome.test.mjs`（「下一拍改到」）。

### E. 复现字号与减轨

1. 设置里打开「较大」，检查 `html[data-text-scale="large"]`。说明文字应随根字号变大，而不是停在 8px。
2. 首页第一屏应能看到证据年份和地点检索；「来源与等级」默认收起。
3. 游戏顶栏主操作不超过证据、图鉴、天下、存档、退出加「更多」。

字号角色定义在 `app/globals.css` 的 `--type-body` / `--type-caption` / `--type-kicker` / `--type-hud`。

### F. 完整门禁（声称完成一个阶段前）

```bash
npm test
```

会跑密钥扫描、迁移账本、内容校验、lint、类型、生产构建、smoke、单元、契约和 Playwright。缺少本机 Chromium 时 e2e 会失败，这不等于内容或规则错误。

## 开源许可

- 软件与文档：MIT，见仓库根目录 `LICENSE`。
- 史料、期刊、博物馆页面、第三方数据库：仍属原权利人。见 `docs/data-licenses.md`。
- 项目手绘示意几何与中文重述：按内容台账处理，不授予文物图像或商标权。

## 不要从本仓库复现的东西

- 不要复现「第二个时代」来证明可扩展。扩展必须走 `docs/scenario-expansion-template.md`，并先完成外部史家审阅。
- 不要把 50 结局表当成 50 篇写好的小说。
- 不要把本地 `npm run build` 成功写成史学验收。
- 不要打开支付、短信、微信或 QQ 来「补齐」产品。
