# ChronoKalamos 实施计划

| 阶段 | 退出条件 | 状态 |
| --- | --- | --- |
| 0. 产品基线 | 范围、史料标签、许可红线和架构决策可检查 | 已完成 |
| 1. 视觉定向 | 选定 Sand & Cinnabar，并落实动效和五语文案规范 | 已完成 |
| 2. 前端原型 | 启动、登录、设定、时间轴、游戏预览、存档和移动降级可点击 | 已完成 |
| 3. 身份与存档 | Supabase 迁移、双用户隔离、私有上传、游客升级和邮件验证可复核 | 已完成 |
| 4. 长安内容包 | 发布条目带来源或重建标签，地图特征带时间、许可和不确定性 | 已完成技术基线；外部史学复核仍需完成 |
| 5. 游戏与 AI | 规则引擎、结构化回合提交和 60 个评测案例通过 | 已完成；生产 DeepSeek 60/60 回合验收通过 |
| 6. 上线硬化 | 安全、无障碍、性能、监控和部署检查全部通过 | 进行中；公开部署与生产 smoke 已验证，Auth 设置和持续观测待完成 |
| 7. 后续集成 | 每次只启用一个通过安全与恢复验收的能力 | 免费 TOTP 已启用并完成用户确认；短信与 Passkey 暂缓 |
| 8. 升级基线 | 能力、原型、筹备中与无法核验状态有统一台账 | 已完成；GitHub连接器权限与Supabase遗留告警保留为外部阻塞 |
| 9. 十分钟上手 | 三种出身都有有限角色设定、个人化开场、首回合选择和回顾边界 | 已完成；Sites v30、390px视口和三种出身各三回合生产验收通过 |

## 阶段 5 当前实现

阶段 5 已建立规则引擎、`AIProvider`、DeepSeek Chat API 适配器、本地提示注入筛查、
SSE 事件、Zod 输出契约、一次受限重试和 Supabase 原子事务。浏览器只能预留和读取
本人的回合；提交与失败 RPC 只允许 `service_role`。模型不能直接写库。

缺少 `DEEPSEEK_API_KEY` 或 `SUPABASE_SECRET_KEY` 时，接口返回 `turn.failed`，界面显示
“本回合未提交”，世界状态保持原版本。生产环境已完成三种出身 × 20 回合的真实
DeepSeek 回合，60/60 提交成功，来源、状态版本、重复请求和 provider 校验全部通过。

## Supabase 迁移

测试项目已应用以下迁移：

- `202607180001_phase3_identity_saves`
- `20260718105631_full_prod_schema`
- `20260718123627_phase3_security_hardening`
- `20260718142752_phase4_historical_content`
- `20260718150936_phase4_historical_origins`
- `20260725121824_phase5_turn_transactions`
- `20260725130108_phase5_session_cleanup`
- `20260725131032_phase5_server_only_commit`
- `20260725131336_phase5_request_fk_index`
- `20260725213000_phase5_deepseek_provider`

最后一个迁移把历史的旧 provider 值归一为 `deepseek-chat`，并限制新回合只能使用
该值。旧事务函数的兼容写入在表级触发器处被安全转换，不恢复任何客户端写权限。

## 已知边界

阶段 5 的本地认证预览已在 Chrome 1440 × 1000 与 390 × 844 下复核。生产站已部署
DeepSeek 版本，真实匿名身份可建立权威会话。缺失服务端密钥的失败回合仍保持 `v0`。
图片输入仍是明确的 `image_not_supported` 边界，尚未启用视觉模型。

## 阶段 6 当前实现

阶段 6 的代码与数据库硬化记录见 [`docs/phase6-hardening.md`](./phase6-hardening.md)。
依赖审计、请求体上限、数据库回合限流、响应安全头、健康检查、输入归一化、真实
Supabase live 验证和公开生产 smoke 已完成。生产错误率、真实移动设备性能和 Supabase
Auth 的 leaked-password protection 仍属于运营级遗留项。

## 阶段 7 当前实现

阶段 7 的机器可检查门禁位于 [`lib/capabilities/phase7.ts`](../lib/capabilities/phase7.ts)。
当前只有邮箱账户 TOTP 处于 `enabled`。短信、手机号登录、Passkey、微信、QQ、
真实打赏和第二历史场景均为
`not_started`。门禁拒绝同时推进两个外部能力，也拒绝缺少证据的能力进入 `ready` 或
`enabled`。

TOTP 注册、挑战、备用因子和数据库 AAL2 限制已经实现。Supabase 项目已应用 7 条
restrictive RLS 策略，并为三个 owner-scoped `SECURITY DEFINER` RPC 增加同等门禁。
用户已于 2026-07-27 报告真实身份验证器的注册、退出、再次登录与 AAL2 访问恢复通过；
自动化双用户隔离测试也已通过。该结论是用户验收报告，不是 Codex 对身份验证器屏幕的独立观察。具体边界见
[`docs/totp-mfa.md`](./totp-mfa.md)。新历史场景必须复用
[`docs/scenario-expansion-template.md`](./scenario-expansion-template.md)。

## 阶段 9 当前实现

阶段9已在 Sites v30 公开发布。姓名、性别、性格和三种出身通过受限RPC写入本人
`character_profile`。历史存档、个人设置和支持说明已有真实面板。图片输入只显示
筹备中，不再暗示 DeepSeek 支持图像。

生产验收用三个一次性匿名身份分别完成三回合。九次提交的状态版本均只推进一次，
每回合返回3—5个选择和来源编号；测试存档已删除。可重复验收脚本为
[`scripts/eval-phase9-production.mjs`](../scripts/eval-phase9-production.mjs)，详细结果见
[`docs/phase9-acceptance-report.md`](./phase9-acceptance-report.md)。
