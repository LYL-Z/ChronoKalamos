# 阶段 4：数据许可台账

## 可发布来源

| ID | 来源类别 | 许可或使用边界 | 本项目处理 |
| --- | --- | --- | --- |
| S-001、S-002、S-008 | 古籍书目 | 古籍本身已进入公版范围；现代整理本、网页转录和数据库界面仍可能受版权约束 | 只保留 MLA 书目、卷次和定位，不复制现代正文 |
| S-003、S-004、S-005、S-006、S-007 | 学术或博物馆研究 | 版权归原作者、期刊或机构；本项目没有取得正文或图版再发布许可 | 只保留书目、DOI、网页链接和经过重述的事实边界 |
| S-009 | Wikidata 结构化数据 | 主命名空间结构化数据按 CC0 提供 | 只使用地点锚点；地图几何由 ChronoKalamos 自行绘制，并保留 CC0 归属说明 |
| S-010 | OpenHistoricalMap 许可说明 | 默认尽量采用 CC0，但逐要素可能有 `license` 与 `attribution` 例外 | 本阶段未导入其图形或数据库；未来导入必须逐要素复核 |

## 禁止直接复制

| ID | 原因 | 结论 |
| --- | --- | --- |
| S-011 CHGIS | 官方页面写明学术研究免费，禁止商业使用、转售或再分发 | 不进入商业数据库；只作为研究线索和许可红线 |
| S-012 CBDB | 项目页面说明中国大陆地区存在独家商业授权，未经授权的商业使用存在风险 | 不复制人物、官职或关系记录；玩家角色不挂接 CBDB |

## 项目自有数据

`content/tang-changan-742/map-features.json` 的示意几何、中文重述、标签和数据结构由本项目编写，标为 `CC0-1.0` 仅表示项目愿意放弃这些新增数据的著作权主张。它不改变上游书籍、期刊、网站或数据库的权利，也不授予商标、肖像或文物图像权利。

## 归属要求

发布地图时必须显示：`ChronoKalamos hand-authored schematic`、相应来源编号、Wikidata 的 CC0 说明，以及未来实际导入数据的逐要素归属。页面不能只写“地图来源：互联网”。

## MLA 研究依据

- China Biographical Database Project. “Exclusive Commercial License.” Harvard University, cbdb.hsites.harvard.edu/exclusive-commercial-license. Accessed 18 July 2026.
- Harvard Yenching Institute and Fudan Center for Historical Geography. “CHGIS V2.” *China Historical Geographic Information System*, chgis.fas.harvard.edu/data/chgis/v2/. Accessed 18 July 2026.
- OpenHistoricalMap contributors. “OpenHistoricalMap/Copyright.” *OpenStreetMap Wiki*, wiki.openstreetmap.org/wiki/OpenHistoricalMap/Copyright. Accessed 18 July 2026.
- Smithsonian Institution. “Historical Trade Routes of the Sogdians.” *The Sogdians*, National Museum of Asian Art, sogdians.si.edu/historic-trade-routes-of-the-sogdians/. Accessed 18 July 2026.
- Wikidata contributors. “Wikidata:Copyright.” *Wikidata*, www.wikidata.org/wiki/Wikidata:Copyright. Accessed 18 July 2026.
- Xue, Pingshuan. “The Merchants of Chang’an in the Sui and Tang Dynasties.” *Frontiers of History in China*, vol. 1, no. 2, 2006, pp. 254–275. doi:10.1007/s11462-006-0005-1.
- Heng, Chye Kiang. “Visualizing Everyday Life in the City: A Categorization System for Residential Wards in Tang Chang’an.” *Journal of the Society of Architectural Historians*, vol. 73, no. 1, 2014, pp. 91–117. doi:10.1525/jsah.2014.73.1.91.
