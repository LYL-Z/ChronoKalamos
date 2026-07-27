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
| 7. 后续集成 | 每次只启用一个通过账号、资质、政策和沙箱验收的能力 | 已进入准备；仅评估手机号登录，公开入口保持关闭 |

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
当前只有手机号登录处于 `evaluating`。微信、QQ、真实打赏和第二历史场景均为
`not_started`。门禁拒绝同时推进两个外部能力，也拒绝缺少证据的能力进入 `ready` 或
`enabled`。

手机号轨道的供应商、目标地区、短信资质、预算、CAPTCHA、账号恢复、
`phone_change` 清理和真实沙箱验收尚未完成，因此公开站不显示手机号或验证码输入。
具体证据要求见 [`docs/provider-onboarding.md`](./provider-onboarding.md)。新历史场景必须
复用 [`docs/scenario-expansion-template.md`](./scenario-expansion-template.md)。
