import type { HistoricalClassification, OriginId, WorldState } from "@/lib/game/schemas";

export const phase17StratumIds = [
  "household-dependent",
  "registered-livelihood",
  "subofficial",
  "literati-candidate",
  "ranked-official",
  "elite-household",
  "sovereign",
] as const;

export type Phase17StratumId = (typeof phase17StratumIds)[number];

export type Phase17Stratum = {
  id: Phase17StratumId;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  label: string;
  gameMeaning: string;
  access: string[];
  exclusions: string[];
  sourceIds: string[];
  classification: HistoricalClassification;
  unlockQuestId: string | null;
};

export const phase17Strata: Phase17Stratum[] = [
  {
    id: "household-dependent",
    level: 1,
    label: "家户依附者",
    gameMeaning: "以亲属、雇佣、学徒或家内差遣进入事件，行动受家户资源与尊长关系限制。",
    access: ["家户事务", "邻里往来", "基础劳作"],
    exclusions: ["没有官署签发权", "不能直接调度公共资源"],
    sourceIds: ["S-015", "S-016"],
    classification: "合理重建",
    unlockQuestId: null,
  },
  {
    id: "registered-livelihood",
    level: 2,
    label: "编户营生者",
    gameMeaning: "覆盖商贸、手工业与一般城市营生。财富不会自动转化为官品。",
    access: ["东西市交易", "作坊生产", "契约与家计"],
    exclusions: ["不是统一的法律阶级", "不能仅凭钱财取得官署权限"],
    sourceIds: ["S-004", "S-008", "S-016"],
    classification: "合理重建",
    unlockQuestId: null,
  },
  {
    id: "subofficial",
    level: 3,
    label: "胥吏与杂任",
    gameMeaning: "处理文书、递送与基层执行，但不等于流内品官。",
    access: ["基层文书", "官署差遣", "案件与簿籍线索"],
    exclusions: ["不参与正式朝会", "无独立任免与财政权"],
    sourceIds: ["S-002", "S-008", "S-017"],
    classification: "合理重建",
    unlockQuestId: null,
  },
  {
    id: "literati-candidate",
    level: 4,
    label: "士人与入仕候选",
    gameMeaning: "通过教育、荐举或科举相关事件获得进入官僚体系的可能性，不保证授官。",
    access: ["经籍学习", "文书与考试事件", "士人关系网"],
    exclusions: ["考试不等于任官", "当前内容包没有完整科举周期"],
    sourceIds: ["S-008", "S-016"],
    classification: "合理重建",
    unlockQuestId: "stratum-literati-approved",
  },
  {
    id: "ranked-official",
    level: 5,
    label: "流内品官",
    gameMeaning: "拥有经编辑事件确认的官职与品秩，才可处理相应公务。",
    access: ["部门公务", "考课与俸禄", "有限政策建议"],
    exclusions: ["官品不等于实际权力", "不能越过所属机构调度天下"],
    sourceIds: ["S-002", "S-008"],
    classification: "合理重建",
    unlockQuestId: "stratum-official-appointed",
  },
  {
    id: "elite-household",
    level: 6,
    label: "宗室、勋贵与高门家户",
    gameMeaning: "合并为高权限玩法层，内部身份差异仍由独立标签保留。",
    access: ["高层婚姻网络", "封爵与家产事件", "宫廷礼仪"],
    exclusions: ["不是把宗室、勋贵和士族视为同一历史类别", "不能自动继承皇权"],
    sourceIds: ["S-008", "S-016"],
    classification: "合理重建",
    unlockQuestId: "stratum-elite-recognized",
  },
  {
    id: "sovereign",
    level: 7,
    label: "帝王权限",
    gameMeaning: "只由明确的架空继位事件开启。所有偏离742年实史的分支均标为叙事虚构。",
    access: ["朝政总览", "人事裁可", "内廷与宗室事务", "全国监察图"],
    exclusions: ["不是历史玄宗模拟档案", "不得把玩家决策写成真实历史"],
    sourceIds: ["S-001", "S-008", "S-016"],
    classification: "叙事虚构",
    unlockQuestId: "stratum-sovereign-accession",
  },
];

const originBaseStratum: Record<OriginId, Phase17StratumId> = {
  merchant: "registered-livelihood",
  craft: "registered-livelihood",
  clerk: "subofficial",
};

export function getPhase17Stratum(state: WorldState): Phase17Stratum {
  const completed = new Set(state.quests.filter((quest) => quest.status === "completed").map((quest) => quest.id));
  const unlocked = phase17Strata.filter((stratum) =>
    stratum.unlockQuestId ? completed.has(stratum.unlockQuestId) : stratum.id === originBaseStratum[state.socialIdentity]
  );
  return unlocked.sort((left, right) => right.level - left.level)[0]
    ?? phase17Strata.find((stratum) => stratum.id === originBaseStratum[state.socialIdentity])!;
}

export type WardEvidenceStatus = "index-only";

export type Phase17Ward = {
  id: string;
  conventionalIndex: number;
  label: string;
  county: "长安县" | "万年县";
  row: number;
  column: number;
  evidenceStatus: WardEvidenceStatus;
  classification: HistoricalClassification;
  sourceIds: string[];
  uncertaintyNote: string;
};

const marketSlots = new Map<number, "西市" | "东市">([[35, "西市"], [76, "东市"]]);

export const phase17Wards: Phase17Ward[] = Array.from({ length: 110 }, (_, slot) => slot + 1)
  .filter((slot) => !marketSlots.has(slot))
  .map((slot, index) => {
    const column = ((slot - 1) % 10) + 1;
    const row = Math.floor((slot - 1) / 10) + 1;
    return {
      id: `ward-${String(index + 1).padStart(3, "0")}`,
      conventionalIndex: index + 1,
      label: `证据待补坊位 ${String(index + 1).padStart(3, "0")}`,
      county: column <= 5 ? "长安县" : "万年县",
      row,
      column,
      evidenceStatus: "index-only",
      classification: "合理重建",
      sourceIds: ["S-003", "S-006"],
      uncertaintyNote: "该格只维持108格玩法口径，不生成未经核验的坊名、宅邸或街巷。",
    };
  });

export const phase17ChanganCells = Array.from({ length: 110 }, (_, slot) => {
  const oneBased = slot + 1;
  const market = marketSlots.get(oneBased);
  const ward = phase17Wards.find((candidate) => candidate.row === Math.floor(slot / 10) + 1 && candidate.column === (slot % 10) + 1);
  return market
    ? { id: `market-${market === "西市" ? "west" : "east"}`, kind: "market" as const, label: market, row: Math.floor(slot / 10) + 1, column: (slot % 10) + 1 }
    : { id: ward!.id, kind: "ward" as const, label: ward!.label, row: ward!.row, column: ward!.column };
});

export type Phase17Circuit = {
  id: string;
  name: string;
  focus: string;
  x: number;
  y: number;
  sourceIds: string[];
  classification: HistoricalClassification;
};

export const phase17Circuits: Phase17Circuit[] = [
  { id: "capital", name: "京畿道", focus: "长安与近畿监察", x: 44, y: 42, sourceIds: ["S-001", "S-016"], classification: "合理重建" },
  { id: "guannei", name: "关内道", focus: "关中及北部区域", x: 39, y: 31, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "metropolitan", name: "都畿道", focus: "洛阳与近畿监察", x: 57, y: 44, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "henan", name: "河南道", focus: "黄河下游与淮北", x: 66, y: 48, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "hedong", name: "河东道", focus: "河东地区", x: 52, y: 29, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "hebei", name: "河北道", focus: "河北及东北交通", x: 69, y: 27, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "longyou", name: "陇右道", focus: "河西与西北军政边界", x: 23, y: 36, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "shannan-east", name: "山南东道", focus: "汉水中下游", x: 55, y: 55, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "shannan-west", name: "山南西道", focus: "汉中及邻近区域", x: 42, y: 54, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "huainan", name: "淮南道", focus: "淮河与江北交通", x: 68, y: 59, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "jiangnan-east", name: "江南东道", focus: "东南沿海与江南东部", x: 77, y: 69, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "jiangnan-west", name: "江南西道", focus: "江南西部", x: 63, y: 70, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "qianzhong", name: "黔中道", focus: "西南山地监察", x: 48, y: 72, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "jiannan", name: "剑南道", focus: "剑阁以南与成都平原", x: 34, y: 66, sourceIds: ["S-016"], classification: "合理重建" },
  { id: "lingnan", name: "岭南道", focus: "岭南及南海交通", x: 63, y: 84, sourceIds: ["S-016"], classification: "合理重建" },
];

export type Phase17SystemAction = {
  id: string;
  label: string;
  domain: "livelihood" | "court" | "palace" | "family";
  minimumStratum: Phase17StratumId;
  actionDraft: string;
  cost: string;
  directionalEffects: string[];
  sourceIds: string[];
  classification: HistoricalClassification;
};

export const phase17SystemActions: Phase17SystemAction[] = [
  { id: "market-audit", label: "核对市券与交割", domain: "livelihood", minimumStratum: "registered-livelihood", actionDraft: "逐项核对市券、货样和交割人，不越过当前事件证据。", cost: "1行动；约30分", directionalEffects: ["市场声望", "关系"], sourceIds: ["S-004", "S-013"], classification: "合理重建" },
  { id: "workshop-inspection", label: "复核工序与材料", domain: "livelihood", minimumStratum: "registered-livelihood", actionDraft: "复核量具、材料签和半成品，记录可追责的工序差异。", cost: "1行动；约35分", directionalEffects: ["专业潜能", "家户声望"], sourceIds: ["S-008", "S-016"], classification: "合理重建" },
  { id: "document-collation", label: "校勘簿籍", domain: "livelihood", minimumStratum: "subofficial", actionDraft: "对照草案、誊清件和递送记号，保留所有修改痕迹。", cost: "1行动；约30分", directionalEffects: ["行政声望", "风险"], sourceIds: ["S-002", "S-017"], classification: "合理重建" },
  { id: "personnel-docket", label: "审阅铨选案", domain: "court", minimumStratum: "ranked-official", actionDraft: "按官品、履历与回避条件审阅铨选案，只提出本职范围内的意见。", cost: "1公务位；奏案", directionalEffects: ["行政声望", "派系压力"], sourceIds: ["S-008"], classification: "合理重建" },
  { id: "revenue-ledger", label: "复核户度账", domain: "court", minimumStratum: "ranked-official", actionDraft: "复核户籍、度支与转运摘要，标出缺证数字，不直接改写国库。", cost: "1公务位；账案", directionalEffects: ["财政", "民生风险"], sourceIds: ["S-008", "S-016"], classification: "合理重建" },
  { id: "ritual-calendar", label: "核定礼仪日程", domain: "court", minimumStratum: "ranked-official", actionDraft: "核对礼仪日程、参与机构和物资需求，提交待裁事项。", cost: "1公务位；礼案", directionalEffects: ["礼仪秩序", "声望"], sourceIds: ["S-008"], classification: "合理重建" },
  { id: "justice-review", label: "复核刑名", domain: "court", minimumStratum: "ranked-official", actionDraft: "复核案情、律文依据与程序缺口，不以玩家偏好替代律令边界。", cost: "1公务位；刑案", directionalEffects: ["司法压力", "行政声望"], sourceIds: ["S-008", "S-015"], classification: "合理重建" },
  { id: "frontier-memorial", label: "审读边报", domain: "court", minimumStratum: "elite-household", actionDraft: "区分军情事实、推测和请功措辞，向有权机构提出有限建议。", cost: "1朝政位；边报", directionalEffects: ["军务风险", "财政"], sourceIds: ["S-001", "S-016"], classification: "合理重建" },
  { id: "palace-provisions", label: "核对内廷供给", domain: "palace", minimumStratum: "elite-household", actionDraft: "核对内廷人员供给、医疗与值役记录，优先处理短缺和申诉。", cost: "1内廷位；簿籍", directionalEffects: ["内廷安定", "财政"], sourceIds: ["S-008"], classification: "合理重建" },
  { id: "palace-petition", label: "听取内廷申诉", domain: "palace", minimumStratum: "sovereign", actionDraft: "分别听取当事人陈述，记录同意、胁迫与利益关系，不以宠爱值替代程序。", cost: "1内廷位；听证", directionalEffects: ["关系", "宫廷风险"], sourceIds: ["S-008"], classification: "叙事虚构" },
  { id: "marriage-discussion", label: "商议婚约", domain: "family", minimumStratum: "registered-livelihood", actionDraft: "在角色均为成年人且明确同意的前提下，商议婚书、财产与居住安排。", cost: "1家户位；协商", directionalEffects: ["家户关系", "钱财"], sourceIds: ["S-015"], classification: "合理重建" },
  { id: "care-plan", label: "安排家户照护", domain: "family", minimumStratum: "household-dependent", actionDraft: "按健康、年龄和现有资源安排照护，不把生育或继承视为强制目标。", cost: "1家户位；照护", directionalEffects: ["健康", "家户声望"], sourceIds: ["S-015", "S-016"], classification: "叙事虚构" },
];

export const phase17CourtInstitutions = [
  ["尚书省", "政务执行与六部总领"], ["中书省", "诏令草拟"], ["门下省", "封驳与审议"],
  ["吏部", "文官铨选与考课"], ["户部", "户籍、赋役与财政"], ["礼部", "礼仪与贡举事务"],
  ["兵部", "军政文书与武官选授"], ["刑部", "律令与刑名复核"], ["工部", "营造与公共工程"],
  ["御史台", "监察纠劾"], ["太常寺", "礼乐祭祀"], ["大理寺", "刑狱审理"],
] as const;

export const phase17PalaceRanks = [
  { group: "中宫", title: "皇后", count: 1, note: "内廷最高名位；具体权力受个案与时代条件影响。" },
  { group: "三妃", title: "惠妃、丽妃、华妃", count: 3, note: "玄宗开元改制口径；不能套用唐初四妃表。" },
  { group: "六仪", title: "淑仪、德仪、贤仪、顺仪、婉仪、芳仪", count: 6, note: "据《唐六典》卷十二的开元制度条目。" },
  { group: "世妇", title: "美人", count: 4, note: "名位数量按开元制度显示。" },
  { group: "世妇", title: "才人", count: 7, note: "名位数量按开元制度显示。" },
] as const;

export const phase17FamilyRules = [
  { id: "adult-only", label: "成年门槛", rule: "所有婚姻、生育与亲密关系玩法只对18岁以上角色开放。", layer: "产品安全规则" },
  { id: "explicit-consent", label: "明确同意", rule: "任何婚约与生育计划均要求相关角色明确同意；胁迫只可作为待处理风险，不能成为奖励机制。", layer: "产品安全规则" },
  { id: "kinship-check", label: "亲属核对", rule: "缔约前检查已知亲属关系和现存婚约；资料不足时阻止自动成立。", layer: "历史边界与安全规则" },
  { id: "written-record", label: "婚书与记录", rule: "婚姻状态只能由编辑事件与事务提交；口头叙事不能直接改写家户状态。", layer: "权威数据规则" },
  { id: "health-not-score", label: "生育不是能力分", rule: "系统不设置生育能力数值，不以子女数量评价角色价值。", layer: "产品伦理规则" },
  { id: "care-before-outcome", label: "照护优先", rule: "妊娠、生产与婴幼儿事件优先表达照护、健康和资源压力；默认不描写血腥细节。", layer: "产品安全规则" },
] as const;

type ItemVariantProfile = "durable" | "consumable" | "document";
type ItemBase = { id: string; name: string; category: string; profile: ItemVariantProfile; baseValue: number; sourceIds: string[] };

const itemBases: ItemBase[] = [
  { id: "hemp-jacket", name: "麻布短褐", category: "服饰", profile: "durable", baseValue: 18, sourceIds: ["S-016"] },
  { id: "round-collar-robe", name: "圆领袍", category: "服饰", profile: "durable", baseValue: 40, sourceIds: ["S-016"] },
  { id: "headcloth", name: "幞头", category: "服饰", profile: "durable", baseValue: 16, sourceIds: ["S-016"] },
  { id: "leather-belt", name: "革带", category: "服饰", profile: "durable", baseValue: 24, sourceIds: ["S-016"] },
  { id: "cloth-shoes", name: "布履", category: "服饰", profile: "durable", baseValue: 14, sourceIds: ["S-016"] },
  { id: "half-sleeve", name: "半臂", category: "服饰", profile: "durable", baseValue: 28, sourceIds: ["S-016"] },
  { id: "shawl", name: "披帛", category: "服饰", profile: "durable", baseValue: 36, sourceIds: ["S-016"] },
  { id: "felt-cap", name: "毡帽", category: "服饰", profile: "durable", baseValue: 22, sourceIds: ["S-004"] },
  { id: "flatbread", name: "胡饼", category: "饮食", profile: "consumable", baseValue: 3, sourceIds: ["S-004", "S-016"] },
  { id: "millet", name: "粟米", category: "饮食", profile: "consumable", baseValue: 5, sourceIds: ["S-016"] },
  { id: "rice", name: "稻米", category: "饮食", profile: "consumable", baseValue: 7, sourceIds: ["S-016"] },
  { id: "tea-cake", name: "茶饼", category: "饮食", profile: "consumable", baseValue: 9, sourceIds: ["S-016"] },
  { id: "dried-grape", name: "葡萄干", category: "饮食", profile: "consumable", baseValue: 11, sourceIds: ["S-004", "S-013"] },
  { id: "pomegranate", name: "石榴", category: "饮食", profile: "consumable", baseValue: 8, sourceIds: ["S-004"] },
  { id: "cheese", name: "乳酪", category: "饮食", profile: "consumable", baseValue: 10, sourceIds: ["S-004", "S-013"] },
  { id: "pepper", name: "胡椒", category: "饮食", profile: "consumable", baseValue: 18, sourceIds: ["S-004", "S-014"] },
  { id: "paper", name: "纸张", category: "文书", profile: "document", baseValue: 6, sourceIds: ["S-008", "S-017"] },
  { id: "ink", name: "墨", category: "文书", profile: "durable", baseValue: 8, sourceIds: ["S-008"] },
  { id: "brush", name: "毛笔", category: "文书", profile: "durable", baseValue: 10, sourceIds: ["S-008"] },
  { id: "inkstone", name: "砚", category: "文书", profile: "durable", baseValue: 20, sourceIds: ["S-008"] },
  { id: "account-book", name: "账簿", category: "文书", profile: "document", baseValue: 9, sourceIds: ["S-004", "S-017"] },
  { id: "letter", name: "书信", category: "文书", profile: "document", baseValue: 5, sourceIds: ["S-017"] },
  { id: "contract", name: "契书", category: "文书", profile: "document", baseValue: 12, sourceIds: ["S-015"] },
  { id: "dispatch", name: "递送文牒", category: "文书", profile: "document", baseValue: 14, sourceIds: ["S-002", "S-017"] },
  { id: "wood-rule", name: "木尺", category: "工具", profile: "durable", baseValue: 12, sourceIds: ["S-008"] },
  { id: "balance", name: "衡器", category: "工具", profile: "durable", baseValue: 28, sourceIds: ["S-004", "S-008"] },
  { id: "spindle", name: "纺锤", category: "工具", profile: "durable", baseValue: 10, sourceIds: ["S-016"] },
  { id: "shuttle", name: "梭", category: "工具", profile: "durable", baseValue: 14, sourceIds: ["S-016"] },
  { id: "hammer", name: "锤", category: "工具", profile: "durable", baseValue: 16, sourceIds: ["S-008"] },
  { id: "chisel", name: "凿", category: "工具", profile: "durable", baseValue: 15, sourceIds: ["S-008"] },
  { id: "dye-bowl", name: "染料钵", category: "工具", profile: "durable", baseValue: 13, sourceIds: ["S-008", "S-016"] },
  { id: "leather-knife", name: "裁革刀", category: "工具", profile: "durable", baseValue: 19, sourceIds: ["S-008"] },
  { id: "weight-set", name: "权衡砝码", category: "器用", profile: "durable", baseValue: 32, sourceIds: ["S-004", "S-008"] },
  { id: "cloth-bale", name: "布帛货包", category: "器用", profile: "durable", baseValue: 60, sourceIds: ["S-004", "S-013"] },
  { id: "ceramic-jar", name: "陶罐", category: "器用", profile: "durable", baseValue: 12, sourceIds: ["S-016"] },
  { id: "oil-lamp", name: "油灯", category: "器用", profile: "durable", baseValue: 9, sourceIds: ["S-016"] },
  { id: "bronze-mirror", name: "铜镜", category: "器用", profile: "durable", baseValue: 45, sourceIds: ["S-016"] },
  { id: "comb", name: "梳", category: "器用", profile: "durable", baseValue: 8, sourceIds: ["S-016"] },
  { id: "incense-box", name: "香盒", category: "器用", profile: "durable", baseValue: 26, sourceIds: ["S-016"] },
  { id: "wood-lock", name: "锁钥", category: "器用", profile: "durable", baseValue: 17, sourceIds: ["S-016"] },
];

const itemVariants: Record<ItemVariantProfile, Array<{ id: string; label: string; multiplier: number }>> = {
  durable: [
    { id: "mended", label: "修补", multiplier: 0.55 },
    { id: "ordinary", label: "常用", multiplier: 1 },
    { id: "sound", label: "完好", multiplier: 1.35 },
    { id: "fine", label: "细作", multiplier: 2 },
    { id: "collected", label: "珍藏", multiplier: 3 },
  ],
  consumable: [
    { id: "ration", label: "口粮", multiplier: 0.65 },
    { id: "daily", label: "日用", multiplier: 1 },
    { id: "market-lot", label: "市售批次", multiplier: 1.25 },
    { id: "festival", label: "节令备办", multiplier: 1.7 },
    { id: "gift", label: "礼赠备办", multiplier: 2.2 },
  ],
  document: [
    { id: "draft", label: "草案", multiplier: 0.6 },
    { id: "working", label: "行用", multiplier: 1 },
    { id: "clean", label: "誊清", multiplier: 1.25 },
    { id: "sealed", label: "封记", multiplier: 1.6 },
    { id: "archived", label: "归档", multiplier: 1.9 },
  ],
};

export const phase17ItemCatalog = itemBases.flatMap((base) =>
  itemVariants[base.profile].map((variant, variantIndex) => ({
    id: `p17-${base.id}-${variant.id}`,
    name: `${base.name} · ${variant.label}`,
    baseName: base.name,
    category: base.category,
    variant: variant.label,
    ledgerValue: Math.max(1, Math.round(base.baseValue * variant.multiplier)),
    rarity: (["common", "common", "uncommon", "rare", "rare"] as const)[variantIndex],
    classification: "合理重建" as const,
    sourceIds: base.sourceIds,
    publicationStatus: "provisional" as const,
    note: "数值仅用于游戏记账，不是742年市场价格表。",
  }))
);

const endingGroups = [
  ["survival", "守住一季", "带着有限资源平安走出本章", "household-dependent"],
  ["market", "市声留名", "在交易、信誉与关系之间留下可追溯结果", "registered-livelihood"],
  ["craft", "百工一线", "以工序、质量和师徒关系决定归宿", "registered-livelihood"],
  ["clerical", "案牍有痕", "文书选择改变责任、升迁或退场方向", "subofficial"],
  ["literati", "纸上前程", "学习与荐举打开或关闭入仕路径", "literati-candidate"],
  ["official", "官箴与代价", "在考课、财政和人事压力中形成官场结局", "ranked-official"],
  ["elite", "门第之网", "高门关系、婚姻与声誉决定家户延续", "elite-household"],
  ["sovereign", "一纸天下", "帝王决策形成明确标注的架空国家结局", "sovereign"],
  ["family", "灯下家书", "照护、婚姻与代际选择形成家庭结局", "registered-livelihood"],
  ["departure", "长安之外", "离城、流转、失败或主动退出构成非胜利结局", "household-dependent"],
] as const;

const endingTones = [
  ["谨守", "以低风险和有限收益保住现状。"],
  ["转机", "关键关系与资源达到转折条件。"],
  ["代价", "目标达成，但至少一项关系、健康或声望受损。"],
  ["失序", "风险钟达到阈值，原定路径中断。"],
  ["余波", "本章结束，但留下未解决风险与重玩入口。"],
] as const;

export const phase17Endings = endingGroups.flatMap(([groupId, groupLabel, groupSummary, minimumStratum], groupIndex) =>
  endingTones.map(([tone, toneSummary], toneIndex) => ({
    id: `ending-${String(groupIndex + 1).padStart(2, "0")}-${String(toneIndex + 1).padStart(2, "0")}`,
    title: `${groupLabel} · ${tone}`,
    group: groupId,
    summary: `${groupSummary}。${toneSummary}`,
    minimumStratum: minimumStratum as Phase17StratumId,
    minimumTurns: 3 + (groupIndex * 3) + toneIndex,
    requiredDomains: [(["household", "market", "administration"] as const)[groupIndex % 3]],
    classification: "叙事虚构" as const,
    sourceIds: groupId === "sovereign" ? ["S-001", "S-008"] : groupId === "family" ? ["S-015"] : ["S-016"],
    publicationStatus: "provisional" as const,
  }))
);

export function canUsePhase17Action(state: WorldState, action: Phase17SystemAction): { allowed: boolean; reason: string } {
  const current = getPhase17Stratum(state);
  const required = phase17Strata.find((stratum) => stratum.id === action.minimumStratum)!;
  if (state.death) return { allowed: false, reason: "角色已死亡。" };
  if (current.level < required.level) return { allowed: false, reason: `需要${required.label}权限；当前为${current.label}。` };
  return { allowed: true, reason: "可写入行动草案；最终结果仍由当前事件规则决定。" };
}

export const phase17Scale = {
  strata: phase17Strata.length,
  wards: phase17Wards.length,
  changanCells: phase17ChanganCells.length,
  circuits: phase17Circuits.length,
  items: phase17ItemCatalog.length,
  endings: phase17Endings.length,
  courtInstitutions: phase17CourtInstitutions.length,
  systemActions: phase17SystemActions.length,
} as const;
