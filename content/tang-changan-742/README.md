# Tang Chang'an 742 内容包

## 发布身份

- Scenario ID：`tang-changan-742`
- 时间：公元 742 年，天宝元年春季起点
- 地理：唐代长安的证据示意图，不是可测量的考古复原
- 出身：O-01 西市粟特商户家庭后辈；O-02 长安工匠家庭学徒；O-03 京兆基层吏员家庭成员
- 语言：中文史实内容；英文为同步的边界译文；法语、希腊语、俄语尚未作为史实内容发布

## 文件

- `sources.json`：来源登记、MLA 书目、定位和许可边界
- `claims.json`：事实、合理重建和叙事虚构的最小单元
- `origins.json`：三种首发出身及其证据入口
- `map-features.json`：带时间、来源、许可和不确定性元数据的示意地图要素

## 数据契约

内容经 `lib/historical/content.ts` 的 Zod schema 解析，并由 `scripts/validate-phase4-content.mjs` 做发布前检查。数据库镜像位于 Supabase 的 `historical_sources`、`historical_claims`、`historical_claim_sources`、`map_features` 和 `map_feature_sources` 表。

客户端只能读取 `published = true` 的数据库行。来源表、claim 表和地图表均启用 RLS，并显式授予 `anon`、`authenticated` 只读权限。任何新增条目必须先修改 JSON、通过内容校验，再生成迁移或种子变更。

## 不可做的事

- 不把合理重建写成史料原文。
- 不把叙事虚构角色接入 CBDB。
- 不复制 CHGIS 或 CBDB 数据到商业数据库。
- 不把现代西安道路、遗址边界或旅游地图直接标为 742 年坐标。
- 不在没有来源编号、时间范围、许可和不确定性说明时发布地图要素。

## 审校状态

当前通道为 `public-beta-unreviewed`。这是可运行的公开测试内容，不是历史学同行评审结论。阶段11新增事实条目仍为 `provisional`。网站持续提示“未经外部历史学家认证”。公开可玩不等于史实获批。

## 阶段11公开测试层

阶段11新增 `chapters.json`、`events.json`、`npcs.json`、`items.json`、`risks.json`、`voice-lines.json` 和 `publication-gate.json`。内容版本与公开运行时版本均为 `11.0.0`。已经推进的10.0.0存档继续读取旧目录，形成回滚与存档兼容边界。

`production-batch-plan.json` 是11.0.0的量产覆盖清单。`lib/historical/phase11-production.ts` 将现有27个事件、12名NPC和8个地点编译为经Zod校验的完整制作合同，包含三幕节拍、三项社会投影、关系带、线索层、镜头、声音和来源定位。统一生产规则位于 `docs/phase11-content-production-bible.md`，跨引擎JSON合同位于 `docs/schemas/phase11-production-bundle.schema.json`。

`lib/historical/phase11-production.eval.test.ts` 包含精确240项可执行评测。数字由81项选择后果、27项证据绑定、36项NPC关系带、24项地点线索层、27项时间表现、15项提示注入、15项时代错置和15项非法状态／幂等合同组成。目标数字本身不是通过证据；只有测试运行结果才是。

新增条目全部保持 `provisional`。`publication-gate.json` 当前为 `pending`，审阅者列表为空，`historicalCertificationClaimed` 为 `false`，`publicRuntimeEnabled` 为 `true`。这组状态刻意区分“允许公开试玩”和“获得历史认证”。

聊天文本、手工录入的姓名或机构名称不能替代签名文件或可核的机构记录。审阅证据还必须逐条补齐来源页码、卷次或稳定条目标识；公开人物的任职资料只能证明身份，不能证明其审阅过本项目。

`voice-lines.json` 含27条人物台词。每条台词均为 `叙事虚构`，并强制配字幕。项目不声称现代普通话设备合成音等于唐代语音复原，也不使用未经授权的真人声纹。

`lib/historical/phase11-citations.ts` 从事件、声明和地点证据中构建100条“事件—来源”链接。100是可追溯的引用链接数，不是100部独立文献。来源台账有18条，其中11条实际进入事件链接。

当前仓库不是Unity工程。`production-batch-plan.json` 中的 `unityStatus` 必须保持 `not-applicable`，直到独立Unity项目通过版本、包、场景、测试与构建验证。
