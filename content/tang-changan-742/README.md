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

这是可运行的内容包基线，不是历史学同行评审结论。发布前需逐条复核古籍卷次、研究页码、中文—英文边界译文和示意几何。 
