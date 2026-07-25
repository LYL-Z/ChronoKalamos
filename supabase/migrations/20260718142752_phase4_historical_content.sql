-- ChronoKalamos phase 4: published historical evidence for Tang Chang'an, 742 CE.
-- This migration is a read-only content mirror for the future RAG layer.
-- The browser never writes these tables. Draft rows remain invisible through RLS.

create table if not exists public.historical_sources (
  id text primary key,
  scenario_id text not null default 'tang-changan-742',
  kind text not null,
  title text not null,
  creator text not null,
  date_label text not null,
  citation_mla text not null,
  locator text not null,
  source_url text,
  license_code text not null,
  usage_note text not null,
  notes text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_sources_id_check check (id ~ '^S-[0-9]{3}$'),
  constraint historical_sources_kind_check check (kind in ('primary', 'scholarship', 'curatorial', 'open-dataset', 'license'))
);

create table if not exists public.historical_claims (
  id text primary key,
  scenario_id text not null default 'tang-changan-742',
  classification text not null,
  subject_kind text not null,
  subject_id text not null,
  text_zh text not null,
  text_en text not null,
  source_ids text[] not null default '{}'::text[],
  source_note text not null,
  valid_from integer not null,
  valid_to integer not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_claims_id_check check (id ~ '^C-[A-Z0-9-]+$'),
  constraint historical_claims_classification_check check (classification in ('史料记载', '合理重建', '叙事虚构')),
  constraint historical_claims_subject_kind_check check (subject_kind in ('scenario', 'institution', 'place', 'origin')),
  constraint historical_claims_dates_check check (valid_from <= valid_to),
  constraint historical_claims_source_check check (classification = '叙事虚构' or cardinality(source_ids) > 0)
);

create table if not exists public.historical_claim_sources (
  claim_id text not null references public.historical_claims (id) on delete cascade,
  source_id text not null references public.historical_sources (id) on delete restrict,
  locator text,
  primary key (claim_id, source_id)
);

create table if not exists public.map_features (
  id text primary key,
  scenario_id text not null default 'tang-changan-742',
  name_zh text not null,
  name_en text not null,
  kind text not null,
  classification text not null,
  valid_from integer not null,
  valid_to integer not null,
  temporal_precision text not null,
  geometry jsonb not null,
  schematic_position jsonb not null,
  uncertainty_code text not null,
  uncertainty_note_zh text not null,
  uncertainty_note_en text not null,
  source_ids text[] not null default '{}'::text[],
  license_code text not null,
  attribution text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_features_id_check check (id ~ '^M-[0-9]{3}$'),
  constraint map_features_kind_check check (kind in ('market', 'gate', 'administration', 'palace', 'ward-grid')),
  constraint map_features_classification_check check (classification in ('史料记载', '合理重建', '叙事虚构')),
  constraint map_features_dates_check check (valid_from <= valid_to),
  constraint map_features_temporal_precision_check check (temporal_precision in ('year', 'decade', 'century')),
  constraint map_features_uncertainty_check check (uncertainty_code in ('low', 'medium', 'high')),
  constraint map_features_source_check check (cardinality(source_ids) > 0)
);

create table if not exists public.map_feature_sources (
  map_feature_id text not null references public.map_features (id) on delete cascade,
  source_id text not null references public.historical_sources (id) on delete restrict,
  locator text,
  primary key (map_feature_id, source_id)
);

alter table public.historical_sources enable row level security;
alter table public.historical_claims enable row level security;
alter table public.historical_claim_sources enable row level security;
alter table public.map_features enable row level security;
alter table public.map_feature_sources enable row level security;

revoke all on table
  public.historical_sources,
  public.historical_claims,
  public.historical_claim_sources,
  public.map_features,
  public.map_feature_sources
from anon, authenticated;

grant select on table
  public.historical_sources,
  public.historical_claims,
  public.historical_claim_sources,
  public.map_features,
  public.map_feature_sources
to anon, authenticated;

drop policy if exists "historical_sources_read_published" on public.historical_sources;
create policy "historical_sources_read_published" on public.historical_sources
  for select to anon, authenticated using (published = true);

drop policy if exists "historical_claims_read_published" on public.historical_claims;
create policy "historical_claims_read_published" on public.historical_claims
  for select to anon, authenticated using (published = true);

drop policy if exists "historical_claim_sources_read_published" on public.historical_claim_sources;
create policy "historical_claim_sources_read_published" on public.historical_claim_sources
  for select to anon, authenticated using (
    exists (
      select 1 from public.historical_claims claim
      where claim.id = historical_claim_sources.claim_id and claim.published = true
    )
  );

drop policy if exists "map_features_read_published" on public.map_features;
create policy "map_features_read_published" on public.map_features
  for select to anon, authenticated using (published = true);

drop policy if exists "map_feature_sources_read_published" on public.map_feature_sources;
create policy "map_feature_sources_read_published" on public.map_feature_sources
  for select to anon, authenticated using (
    exists (
      select 1 from public.map_features feature
      where feature.id = map_feature_sources.map_feature_id and feature.published = true
    )
  );

create index if not exists historical_sources_scenario_published_idx
  on public.historical_sources (scenario_id, published);
create index if not exists historical_claims_scenario_published_idx
  on public.historical_claims (scenario_id, published);
create index if not exists historical_claims_subject_idx
  on public.historical_claims (subject_kind, subject_id);
create index if not exists map_features_scenario_published_idx
  on public.map_features (scenario_id, published);
create index if not exists historical_claim_sources_source_id_idx
  on public.historical_claim_sources (source_id);
create index if not exists map_feature_sources_source_id_idx
  on public.map_feature_sources (source_id);

-- The seed rows below mirror content/tang-changan-742/*.json. The JSON files are
-- the authoring source; these rows are the read-only database mirror for RAG.
insert into public.historical_sources
  (id, kind, title, creator, date_label, citation_mla, locator, source_url, license_code, usage_note, notes, published)
values
  ('S-001', 'primary', $$《旧唐书·玄宗本纪》$$, $$刘昫等$$, $$后晋·开运二年（945）$$, $$Liu Xu et al. Jiu Tang Shu. Zhonghua Shuju, 1975.$$,
   $$玄宗本纪；天宝年号编年$$, null, $$citation-only$$, $$仅作书目与定位；不复制现代整理本正文或数据库转录。$$, $$本条目用于核对年号与编年。它不证明某个虚构人物的经历。$$, true),
  ('S-002', 'primary', $$《通典·职官十五》$$, $$杜佑$$, $$唐·贞元十七年（801）成书$$, $$Du You. Tongdian, juan 33, Zhiguan 15. Chinese Text Project, ctext.org/tongdian/33/zh.$$,
   $$京兆府沿革与属官说明$$, $$https://ctext.org/tongdian/33/zh$$, $$citation-only$$, $$引用古籍定位；不复制网站现代转录文本。$$, $$古籍成书年代与记载年代不同。此处只使用其制度史信息。$$, true),
  ('S-003', 'scholarship', $$Sui-Tang Chang'an: A Study in Urban History$$, $$Victor Cunrui Xiong$$, $$2000$$, $$Xiong, Victor Cunrui. Sui-Tang Chang'an: A Study in Urban History. Center for Chinese Studies, University of Michigan, 2000.$$,
   $$城市格局、宫城、市场与坊制的综合研究$$, null, $$citation-only$$, $$只引用观点与页码定位；不复制图版、表格或正文。$$, $$用于合理重建，不把学者的复原图当作742年的测量边界。$$, true),
  ('S-004', 'scholarship', $$The Merchants of Chang'an in the Sui and Tang Dynasties$$, $$薛平拴（Xue Pingshuan）$$, $$2006$$, $$Xue, Pingshuan. “The Merchants of Chang'an in the Sui and Tang Dynasties.” Frontiers of History in China, vol. 1, no. 2, 2006, pp. 254–275. doi:10.1007/s11462-006-0005-1.$$,
   $$商业人口、外来商人与城市贸易$$, $$https://doi.org/10.1007/s11462-006-0005-1$$, $$citation-only$$, $$按期刊许可引用；不复制全文或图表。$$, $$支持商贸背景的合理重建，不单独证明某个粟特家庭。$$, true),
  ('S-005', 'curatorial', $$Historical Trade Routes of the Sogdians$$, $$Smithsonian Institution, National Museum of Asian Art$$, $$网页资料，访问 2026-07-18$$, $$Smithsonian Institution. “Historical Trade Routes of the Sogdians.” The Sogdians, National Museum of Asian Art, sogdians.si.edu/historic-trade-routes-of-the-sogdians/. Accessed 18 July 2026.$$,
   $$长安、西市与粟特商贸网络说明$$, $$https://sogdians.si.edu/historic-trade-routes-of-the-sogdians/$$, $$citation-only$$, $$只作研究导航与事实核对；不复制页面文字或图片。$$, $$博物馆教育页面不是742年户籍档案，因此相关叙事仍标为合理重建。$$, true),
  ('S-006', 'scholarship', $$Visualizing Everyday Life in the City: A Categorization System for Residential Wards in Tang Chang'an$$, $$Heng Chye Kiang$$, $$2014$$, $$Heng, Chye Kiang. “Visualizing Everyday Life in the City: A Categorization System for Residential Wards in Tang Chang'an.” Journal of the Society of Architectural Historians, vol. 73, no. 1, 2014, pp. 91–117. doi:10.1525/jsah.2014.73.1.91.$$,
   $$坊区结构与数字复原的方法说明$$, $$https://doi.org/10.1525/jsah.2014.73.1.91$$, $$citation-only$$, $$只引用研究结论；不复制数字复原图。$$, $$用于解释坊区的空间不确定性。$$, true),
  ('S-007', 'scholarship', $$唐长安城城门管理制度研究$$, $$肖爱玲、周晓$$, $$2010$$, $$Xiao, Ailing, and Zhou Xia. “A Study of the Control System of City Gates of Chang'an in the Tang Dynasty.” Journal of Shaanxi Normal University, 2010.$$,
   $$城门开启、关闭与夜禁制度$$, $$https://www.xuebao.snnu.edu.cn/info/1072/8558.htm$$, $$citation-only$$, $$按期刊网页条件引用；不复制正文。$$, $$支持城门制度的合理重建，不给出某次具体开门事件。$$, true),
  ('S-008', 'primary', $$《唐六典》$$, $$李林甫等编$$, $$唐·开元二十六年（738）前后编纂$$, $$Li Linfu et al., compilers. Tang Liudian. Zhonghua Shuju, 1992.$$,
   $$官署、工匠与职掌条目$$, null, $$citation-only$$, $$仅作古籍定位；不复制现代整理本。$$, $$制度条文不能直接推出某个家庭的日常生活。$$, true),
  ('S-009', 'open-dataset', $$Wikidata structured data and Daming Palace item$$, $$Wikimedia Foundation and Wikidata contributors$$, $$访问 2026-07-18$$, $$Wikidata contributors. “Daming Palace (Q1158530).” Wikidata, www.wikidata.org/wiki/Q1158530. Accessed 18 July 2026.$$,
   $$地点名称、坐标锚点与世界遗产关联$$, $$https://www.wikidata.org/wiki/Q1158530$$, $$CC0-1.0$$, $$仅使用结构化数据中的地点锚点；本项目另行绘制示意几何并保留来源说明。$$, $$Wikidata 的结构化数据可按CC0使用，但不等于历史边界已被证实。$$, true),
  ('S-010', 'license', $$OpenHistoricalMap Copyright and Acknowledgements$$, $$OpenHistoricalMap contributors$$, $$访问 2026-07-18$$, $$OpenHistoricalMap contributors. “OpenHistoricalMap/Copyright.” OpenStreetMap Wiki, wiki.openstreetmap.org/wiki/OpenHistoricalMap/Copyright. Accessed 18 July 2026.$$,
   $$CC0默认许可与逐要素许可例外$$, $$https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Copyright$$, $$CC0-1.0$$, $$本阶段只记录许可边界，未复制OpenHistoricalMap图形或数据库。$$, $$未来如导入要素，必须逐要素核对license与attribution标签。$$, true),
  ('S-011', 'license', $$CHGIS V2 License$$, $$Harvard Yenching Institute and Fudan Center for Historical Geography$$, $$2003$$, $$Harvard Yenching Institute and Fudan Center for Historical Geography. “CHGIS V2.” China Historical Geographic Information System, chgis.fas.harvard.edu/data/chgis/v2/. Accessed 18 July 2026.$$,
   $$学术研究免费；禁止商业使用、转售或再分发$$, $$https://chgis.fas.harvard.edu/data/chgis/v2/$$, $$restricted-noncommercial$$, $$禁止作为本产品的商业数据源；仅作研究线索。$$, $$本内容包未复制CHGIS数据。$$, true),
  ('S-012', 'license', $$CBDB Exclusive Commercial License$$, $$China Biographical Database Project$$, $$访问 2026-07-18$$, $$China Biographical Database Project. “Exclusive Commercial License.” Harvard University, cbdb.hsites.harvard.edu/exclusive-commercial-license. Accessed 18 July 2026.$$,
   $$中国大陆地区商业授权限制$$, $$https://cbdb.hsites.harvard.edu/exclusive-commercial-license$$, $$restricted-commercial$$, $$未经书面授权不得复制或用于商业产品。$$, $$本内容包不复制CBDB人物记录。$$, true)
on conflict (id) do update set
  scenario_id = excluded.scenario_id, kind = excluded.kind, title = excluded.title, creator = excluded.creator,
  date_label = excluded.date_label, citation_mla = excluded.citation_mla, locator = excluded.locator,
  source_url = excluded.source_url, license_code = excluded.license_code, usage_note = excluded.usage_note,
  notes = excluded.notes, published = excluded.published, updated_at = now();

insert into public.historical_claims
  (id, classification, subject_kind, subject_id, text_zh, text_en, source_ids, source_note, valid_from, valid_to, published)
values
  ('C-742-001', $$史料记载$$, $$scenario$$, $$tang-changan-742$$, $$742年是唐玄宗天宝元年；本内容包将天宝元年春季作为叙事起点。$$, $$742 CE is the first year of Tianbao under Emperor Xuanzong; this package begins in spring of that year.$$,
   array['S-001'], $$年号与编年定位；不据此推断角色经历。$$, 742, 742, true),
  ('C-742-002', $$合理重建$$, $$scenario$$, $$tang-changan-742$$, $$唐代长安将居住坊区与市场空间分置；东市与西市构成城市商业秩序的一部分。$$, $$Tang Chang'an separated residential wards from market spaces; the Eastern and Western Markets formed part of the city's commercial order.$$,
   array['S-003','S-004','S-006'], $$由城市史、商业史与坊区研究综合重建；不是一张逐店铺地图。$$, 582, 907, true),
  ('C-742-003', $$合理重建$$, $$scenario$$, $$tang-changan-742$$, $$长安城门存在开启、关闭与夜间通行管理；本包只把它作为制度背景，不生成具体执法记录。$$, $$Chang'an's gates were subject to opening, closing, and night-travel controls; the package treats this as institutional context, not a specific enforcement record.$$,
   array['S-007','S-008'], $$制度研究支持背景，不能证明某个角色在某天遇到某名守门人。$$, 582, 907, true),
  ('C-742-004', $$史料记载$$, $$institution$$, $$jingzhao-fu$$, $$开元元年（713），雍州改称京兆府；京兆府承担首都地区的政务。$$, $$In 713, Yong Prefecture was renamed Jingzhao Fu, which handled administration in the capital region.$$,
   array['S-002'], $$《通典·职官十五》的沿革条目；不等同于某个具体吏员的个人档案。$$, 713, 907, true),
  ('C-742-005', $$合理重建$$, $$place$$, $$western-market$$, $$西市与长安西部交通和跨区域商业活动相连；西市具体店铺、租约与家庭名单在本包中不作史实声称。$$, $$The Western Market connected western Chang'an with long-distance commerce; this package makes no factual claim about individual shops, leases, or household lists.$$,
   array['S-003','S-004','S-005'], $$来源支持城市商业背景；具体店铺由叙事层另行标注。$$, 618, 907, true),
  ('C-742-006', $$合理重建$$, $$place$$, $$daming-palace$$, $$大明宫位于长安城北部偏东，是唐代宫城复原中的重要参照；本包不把现代遗址边界直接当作742年的城界。$$, $$Daming Palace lay north-east of the city and is an important reference for reconstructing Tang Chang'an; the modern archaeological boundary is not treated as the 742 CE city boundary.$$,
   array['S-003','S-009'], $$地点锚点与城市史结合；几何采用本项目手绘示意坐标。$$, 663, 907, true),
  ('C-O01-001', $$合理重建$$, $$origin$$, $$merchant$$, $$粟特商人和移民在唐代跨区域商业网络中扮演重要角色，部分人在长安形成社群。$$, $$Sogdian merchants and migrants played important roles in Tang long-distance commerce, and some formed communities in Chang'an.$$,
   array['S-004','S-005'], $$支持社会背景；不证明某一家庭的族谱、店铺或资产。$$, 618, 907, true),
  ('C-O01-002', $$叙事虚构$$, $$origin$$, $$merchant$$, $$O-01的姓名、年龄、家庭成员、账簿内容与第一天行动是叙事参数，不是史料人物档案。$$, $$O-01's name, age, family members, ledger contents, and first-day actions are narrative parameters, not a historical dossier.$$,
   '{}'::text[], $$无直接史料声称；使用虚构标签连接可证实的社会背景。$$, 742, 742, true),
  ('C-O02-001', $$合理重建$$, $$origin$$, $$craft$$, $$唐代长安存在手工业生产、官署工艺与城市交易的交叉场景；本包不把某个家族作坊定位为已发现遗址。$$, $$Tang Chang'an brought together craft production, state workshops, and urban trade; this package does not identify a particular family workshop as an excavated site.$$,
   array['S-003','S-004','S-008'], $$由制度与城市史综合重建；具体工序与家庭关系仍需叙事标签。$$, 618, 907, true),
  ('C-O02-002', $$叙事虚构$$, $$origin$$, $$craft$$, $$O-02的师徒关系、材料清单、工坊冲突和每日任务属于叙事虚构。$$, $$O-02's apprenticeship, material list, workshop conflicts, and daily tasks are fictional narrative elements.$$,
   '{}'::text[], $$不冒充某件出土文书或某个已知工匠家庭。$$, 742, 742, true),
  ('C-O03-001', $$史料记载$$, $$origin$$, $$clerk$$, $$742年长安处在京兆府的首都行政体系内；京兆府有长官和属官处理辖区事务。$$, $$In 742 Chang'an belonged to the Jingzhao Fu capital administration, with senior and subordinate officials handling its affairs.$$,
   array['S-002'], $$制度沿革是史料记载；并不等于存在可追溯的基层家庭成员档案。$$, 713, 907, true),
  ('C-O03-002', $$合理重建$$, $$origin$$, $$clerk$$, $$基层文书、里坊边界和行政传递可以作为京兆基层家庭的叙事环境，但具体工作流程须逐回合标注。$$, $$Clerical documents, ward boundaries, and administrative dispatches can frame a Jingzhao household, but each concrete workflow must be labelled per turn.$$,
   array['S-002','S-006','S-008'], $$这是制度环境的合理重建，不是个人履历。$$, 742, 742, true),
  ('C-O03-003', $$叙事虚构$$, $$origin$$, $$clerk$$, $$O-03的姓名、亲属、住址、文书内容和升迁或死亡结局属于叙事虚构。$$, $$O-03's name, relatives, address, document contents, and promotion or death outcomes are fictional narrative elements.$$,
   '{}'::text[], $$不把虚构个人包装为CBDB或其他人物数据库记录。$$, 742, 742, true)
on conflict (id) do update set
  classification = excluded.classification, subject_kind = excluded.subject_kind, subject_id = excluded.subject_id,
  text_zh = excluded.text_zh, text_en = excluded.text_en, source_ids = excluded.source_ids,
  source_note = excluded.source_note, valid_from = excluded.valid_from, valid_to = excluded.valid_to,
  published = excluded.published, updated_at = now();

insert into public.historical_claim_sources (claim_id, source_id)
select claim.id, source_id
from public.historical_claims claim
cross join unnest(claim.source_ids) as source_id
on conflict (claim_id, source_id) do nothing;

insert into public.map_features
  (id, name_zh, name_en, kind, classification, valid_from, valid_to, temporal_precision, geometry, schematic_position,
   uncertainty_code, uncertainty_note_zh, uncertainty_note_en, source_ids, license_code, attribution, published)
values
  ('M-001', $$西市$$, $$Western Market$$, $$market$$, $$合理重建$$, 618, 907, $$century$$,
   $$ {"type":"Point","coordinateSystem":"schematic-changan-grid-v1","coordinates":[58,57]} $$::jsonb, $$ {"left":58,"top":57} $$::jsonb,
   $$high$$, $$示意锚点，不提供可测量的742年店铺边界。$$, $$Schematic anchor; it is not a measurable 742 CE shop boundary.$$,
   array['S-003','S-004','S-005'], $$CC0-1.0$$, $$ChronoKalamos hand-authored schematic; sources S-003, S-004, S-005.$$ , true),
  ('M-002', $$金光门$$, $$Jinguang Gate$$, $$gate$$, $$合理重建$$, 582, 907, $$century$$,
   $$ {"type":"Point","coordinateSystem":"schematic-changan-grid-v1","coordinates":[36,70]} $$::jsonb, $$ {"left":36,"top":70} $$::jsonb,
   $$high$$, $$城门位置按城市史示意；没有把现代道路中心线当作唐代坐标。$$, $$The gate is schematic; modern road centerlines are not treated as Tang coordinates.$$,
   array['S-003','S-007'], $$CC0-1.0$$, $$ChronoKalamos hand-authored schematic; sources S-003 and S-007.$$ , true),
  ('M-003', $$京兆府$$, $$Jingzhao Fu$$, $$administration$$, $$合理重建$$, 713, 907, $$year$$,
   $$ {"type":"Point","coordinateSystem":"schematic-changan-grid-v1","coordinates":[78,37]} $$::jsonb, $$ {"left":78,"top":37} $$::jsonb,
   $$high$$, $$这是行政范围提示，不是已定位的府署建筑坐标。$$, $$This marks an administrative context, not a located office building.$$,
   array['S-002','S-003'], $$CC0-1.0$$, $$ChronoKalamos hand-authored schematic; sources S-002 and S-003.$$ , true),
  ('M-004', $$大明宫$$, $$Daming Palace$$, $$palace$$, $$合理重建$$, 663, 907, $$century$$,
   $$ {"type":"Point","coordinateSystem":"schematic-changan-grid-v1","coordinates":[80,18]} $$::jsonb, $$ {"left":80,"top":18} $$::jsonb,
   $$high$$, $$使用开放结构化地点锚点辅助绘制；不复制现代遗址边界。$$, $$An open structured-data anchor informs the drawing; the modern ruin boundary is not copied.$$,
   array['S-003','S-009'], $$CC0-1.0$$, $$ChronoKalamos hand-authored schematic; Wikidata structured data under CC0.$$ , true),
  ('M-005', $$坊区网格$$, $$Residential ward grid$$, $$ward-grid$$, $$合理重建$$, 582, 907, $$century$$,
   $$ {"type":"Polygon","coordinateSystem":"schematic-changan-grid-v1","coordinates":[[[12,28],[48,28],[48,80],[12,80],[12,28]]]} $$::jsonb, $$ {"left":30,"top":52} $$::jsonb,
   $$high$$, $$网格表达坊制的空间逻辑，不声称每条街巷的实际走向。$$, $$The grid expresses ward logic, not the surveyed course of every street.$$,
   array['S-003','S-006'], $$CC0-1.0$$, $$ChronoKalamos hand-authored schematic; sources S-003 and S-006.$$ , true)
on conflict (id) do update set
  name_zh = excluded.name_zh, name_en = excluded.name_en, kind = excluded.kind,
  classification = excluded.classification, valid_from = excluded.valid_from, valid_to = excluded.valid_to,
  temporal_precision = excluded.temporal_precision, geometry = excluded.geometry, schematic_position = excluded.schematic_position,
  uncertainty_code = excluded.uncertainty_code, uncertainty_note_zh = excluded.uncertainty_note_zh,
  uncertainty_note_en = excluded.uncertainty_note_en, source_ids = excluded.source_ids,
  license_code = excluded.license_code, attribution = excluded.attribution, published = excluded.published, updated_at = now();

insert into public.map_feature_sources (map_feature_id, source_id)
select feature.id, source_id
from public.map_features feature
cross join unnest(feature.source_ids) as source_id
on conflict (map_feature_id, source_id) do nothing;
