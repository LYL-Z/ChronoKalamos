import { z } from "zod";
import batchPlanJson from "@/content/tang-changan-742/production-batch-plan.json";
import { changanContent } from "@/lib/historical/content";
import { phase11Content } from "@/lib/historical/phase11";
import { phase11CinematicScenes } from "@/lib/historical/phase11-cinematic";
import { phase11CitationLinks } from "@/lib/historical/phase11-citations";

const boundedIdSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);
const sourceIdSchema = z.string().regex(/^S-\d{3}$/);
const claimIdSchema = z.string().regex(/^C-[A-Z0-9-]+$/);
const publicationStatusSchema = z.literal("provisional");

const axisEffectSchema = z.object({
  operation: z.enum(["increase", "decrease", "no_change"]),
  canonicalStatePaths: z.array(z.string().regex(/^worldState\./)),
  rationale: z.string().min(10).max(240),
}).strict();

const socialEffectSchema = z.object({
  choiceId: z.string().regex(/^choice-[1-5]$/),
  accessBand: axisEffectSchema,
  prestigeBand: axisEffectSchema,
  factionPosture: axisEffectSchema,
}).strict();

const dramaticBeatsSchema = z.object({
  setup: z.string().min(10).max(180),
  complication: z.string().min(10).max(240),
  decision: z.string().min(10).max(240),
  aftermath: z.string().min(10).max(240),
  foreshadowing: z.string().min(5).max(180),
}).strict();

const eventProductionSchema = z.object({
  eventId: boundedIdSchema,
  narrativeRole: z.enum(["main", "consequence", "social-vignette", "hidden-world"]),
  dramaticBeats: dramaticBeatsSchema,
  socialEffects: z.array(socialEffectSchema).min(3).max(5),
  clueIds: z.array(boundedIdSchema),
  dialogueLineIds: z.array(boundedIdSchema).min(1),
  cinematicCueIds: z.array(boundedIdSchema).min(1),
  audioCueIds: z.array(boundedIdSchema).min(1),
  evidenceRefs: z.array(sourceIdSchema).min(3),
  publicationStatus: publicationStatusSchema,
}).strict();

const relationshipBandSchema = z.object({
  band: z.enum(["hostile", "guarded", "neutral", "cooperative", "confidant"]),
  informationIds: z.array(boundedIdSchema),
}).strict();

const voiceDirectionSchema = z.object({
  language: z.literal("zh-CN"),
  register: z.string().min(3).max(120),
  emotion: z.string().min(2).max(80),
  paceWpm: z.number().int().min(120).max(260),
  emphasisWords: z.array(z.string().min(1)),
  breathBeforeMs: z.number().int().min(0).max(3000),
  pausesMs: z.array(z.number().int().min(0).max(3000)),
  pronunciationStatus: z.literal("modern-mandarin"),
}).strict();

const npcProductionSchema = z.object({
  npcId: boundedIdSchema,
  publicGoal: z.string().min(5).max(180),
  privateMotive: z.string().min(5).max(180),
  dailyPressure: z.string().min(5).max(180),
  moralBoundary: z.string().min(5).max(180),
  factionId: boundedIdSchema,
  relationshipBands: z.array(relationshipBandSchema).length(5),
  voiceDirection: voiceDirectionSchema,
  historicalClaimIds: z.array(claimIdSchema),
  publicationStatus: publicationStatusSchema,
}).strict();

const clueSchema = z.object({
  clueId: boundedIdSchema,
  layer: z.enum(["surface", "concealed", "relational"]),
  classification: z.enum(["史料记载", "合理重建", "叙事虚构"]),
  claimIds: z.array(claimIdSchema),
  sourceIds: z.array(sourceIdSchema).min(1),
  locatorNotes: z.array(z.string().min(3)).min(1),
  interactionVerb: z.enum(["observe", "compare", "ask", "test", "trace"]),
  uncertaintyNote: z.string().min(10).max(300),
}).strict();

const locationProductionSchema = z.object({
  mapFeatureId: z.string().regex(/^M-\d{3}$/),
  runtimeLocationId: boundedIdSchema,
  clues: z.array(clueSchema).min(4),
  timeStates: z.tuple([
    z.literal("morning"),
    z.literal("day"),
    z.literal("dusk"),
    z.literal("night"),
  ]),
  establishingShotId: boundedIdSchema,
  environmentAudioIds: z.array(boundedIdSchema).min(1),
  uncertaintyNote: z.string().min(20).max(500),
  sourceIds: z.array(sourceIdSchema).min(1),
  publicationStatus: publicationStatusSchema,
}).strict();

const assetRecordSchema = z.object({
  assetId: boundedIdSchema,
  domain: z.enum(["character", "environment", "ui", "audio", "fx"]),
  format: z.enum(["glb", "gltf", "png", "webp", "wav", "ogg", "json"]),
  licenseCode: z.string().min(2).max(80),
  sourceIds: z.array(sourceIdSchema),
  classification: z.enum(["史料记载", "合理重建", "叙事虚构"]),
  reviewStatus: z.enum(["draft", "historical-review", "license-review", "approved"]),
}).strict();

export const phase11ProductionBundleSchema = z.object({
  contentVersion: z.string().regex(/^11\.\d+\.\d+$/),
  scenarioId: z.literal("tang-changan-742"),
  publicationStatus: publicationStatusSchema,
  stateAuthority: z.literal("server-rules-and-supabase-transaction"),
  unityStatus: z.enum(["not-applicable", "project-verified", "import-validated", "build-validated"]),
  events: z.array(eventProductionSchema).length(27),
  npcs: z.array(npcProductionSchema).length(12),
  locations: z.array(locationProductionSchema).length(8),
  assetManifest: z.array(assetRecordSchema),
}).strict();

export type Phase11ProductionBundle = z.infer<typeof phase11ProductionBundleSchema>;
export type Phase11ProductionEvent = z.infer<typeof eventProductionSchema>;
export type Phase11ProductionNpc = z.infer<typeof npcProductionSchema>;
export type Phase11ProductionLocation = z.infer<typeof locationProductionSchema>;

type NpcProfile = Omit<
  Phase11ProductionNpc,
  "npcId" | "relationshipBands" | "historicalClaimIds" | "publicationStatus"
>;

const npcProfiles: Record<string, NpcProfile> = {
  "kang-muyan": {
    publicGoal: "把账目整理到足以复核，并维持家庭在市场中的可信度。",
    privateMotive: "他想证明谨慎不是迟钝，也不愿再替长辈掩盖含混记录。",
    dailyPressure: "交割窗口在缩短，家中每个人都把延误归到管事身上。",
    moralBoundary: "他可以接受损失，但拒绝删去已经发现的疑点。",
    factionId: "merchant-household",
    voiceDirection: {
      language: "zh-CN",
      register: "克制、逐项陈述，避免把粟特身份写成固定口音。",
      emotion: "审慎而疲惫",
      paceWpm: 158,
      emphasisWords: ["疑点", "经手", "复核"],
      breathBeforeMs: 320,
      pausesMs: [260, 420],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "nasi-ban": {
    publicGoal: "在短期损失与家庭信用之间给出能被全家接受的决定。",
    privateMotive: "他担心年轻人只看眼前账面，也担心自己的旧例已不再可靠。",
    dailyPressure: "每次延误都要由他向家族成员解释。",
    moralBoundary: "他会要求服从，却不允许把责任推给无法申辩的人。",
    factionId: "merchant-household",
    voiceDirection: {
      language: "zh-CN",
      register: "短句、低声、先问责任再谈得失，不伪造历史方言。",
      emotion: "沉着而警觉",
      paceWpm: 146,
      emphasisWords: ["信用", "责任", "今日"],
      breathBeforeMs: 500,
      pausesMs: [420, 560],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "du-liuniang": {
    publicGoal: "让交易双方在仍可接受的范围内完成交割。",
    privateMotive: "她维护自己的信息优势，也不愿被任何一方当作替罪者。",
    dailyPressure: "价格、证词和人情同时变化，她必须保住继续出面的资格。",
    moralBoundary: "她可以保留消息来源，但不会替一方伪造共同见证。",
    factionId: "western-market-brokers",
    voiceDirection: {
      language: "zh-CN",
      register: "准确、留有余地，用反问检验对方是否真正理解。",
      emotion: "敏锐而疏离",
      paceWpm: 174,
      emphasisWords: ["同意", "见证", "说法"],
      breathBeforeMs: 180,
      pausesMs: [220, 360],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "kang-ata": {
    publicGoal: "在时间窗口关闭前把消息送到正确的人手中。",
    privateMotive: "他想摆脱只会跑腿的评价，又害怕承认消息来源不清。",
    dailyPressure: "一次迟到或误传就可能让所有人把损失归到他身上。",
    moralBoundary: "他会省略自己的慌乱，但不愿捏造从未见过的经手人。",
    factionId: "merchant-messengers",
    voiceDirection: {
      language: "zh-CN",
      register: "呼吸偏急，信息先于解释，不模仿族群口音。",
      emotion: "紧张而求证",
      paceWpm: 196,
      emphasisWords: ["门", "消息", "来不及"],
      breathBeforeMs: 120,
      pausesMs: [160, 240],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "he-jiucheng": {
    publicGoal: "按可接受的工序和交期完成委托，守住作坊声誉。",
    privateMotive: "他害怕一次失败暴露自己对材料与人手的判断失误。",
    dailyPressure: "材料不足、学徒经验有限，委托人却只看到交期。",
    moralBoundary: "他可以压缩工序，但不允许把明显缺陷当作合格交付。",
    factionId: "craft-workshop",
    voiceDirection: {
      language: "zh-CN",
      register: "以工序和责任说话，命令简短，不伪造行业黑话。",
      emotion: "严厉而自持",
      paceWpm: 152,
      emphasisWords: ["工序", "交付", "返工"],
      breathBeforeMs: 380,
      pausesMs: [280, 440],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "a-huai": {
    publicGoal: "把量具、材料与经验判断之间的差异说明白。",
    privateMotive: "他愿意帮忙，却不愿自己的技术判断被师长或学徒占为己有。",
    dailyPressure: "每次复核都会拖慢自己的工序。",
    moralBoundary: "他不替任何人掩盖已经确认的偏差。",
    factionId: "craft-workers",
    voiceDirection: {
      language: "zh-CN",
      register: "平实、具体，先说手上证据，再说个人判断。",
      emotion: "专注而戒备",
      paceWpm: 166,
      emphasisWords: ["再量", "偏差", "依据"],
      breathBeforeMs: 240,
      pausesMs: [220, 320],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "liu-erniang": {
    publicGoal: "在材料质量、价格与供货时间之间维持可持续交易。",
    privateMotive: "她不想因作坊的赶工承担本不属于自己的质量责任。",
    dailyPressure: "存货有限，每一份延期都影响下一位买主。",
    moralBoundary: "她可以议价，但拒绝把不明材料说成已经核验。",
    factionId: "material-suppliers",
    voiceDirection: {
      language: "zh-CN",
      register: "条目清楚、拒绝含混承诺，不伪造市井俚语。",
      emotion: "干练而克制",
      paceWpm: 178,
      emphasisWords: ["材料", "现货", "条件"],
      breathBeforeMs: 180,
      pausesMs: [180, 300],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "zhao-xiaoqi": {
    publicGoal: "证明自己参与了关键工序，并避免为他人的决定背责。",
    privateMotive: "他既想与玩家合作，也把玩家看作争夺认可的同辈。",
    dailyPressure: "返工越多，他越担心劳动不会留下记录。",
    moralBoundary: "他会争功，但不会接受把共同失误全部推给一个人。",
    factionId: "craft-apprentices",
    voiceDirection: {
      language: "zh-CN",
      register: "语速略快，情绪先露出半步，仍避免现代口头禅。",
      emotion: "好胜而不安",
      paceWpm: 188,
      emphasisWords: ["一起", "谁做的", "记下来"],
      breathBeforeMs: 120,
      pausesMs: [160, 260],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "han-yansheng": {
    publicGoal: "让文书差异、复核过程和最终决定都可被后人追索。",
    privateMotive: "他想维护书手的专业判断，不愿只充当替属官担责的人。",
    dailyPressure: "催办越急，保留疑点越容易被视为拖延。",
    moralBoundary: "他可以接受上级决定，但不会替无依据的改写作证。",
    factionId: "jingzhao-scribes",
    voiceDirection: {
      language: "zh-CN",
      register: "用词谨慎，先区分版本和证据，再讨论责任。",
      emotion: "冷静而坚持",
      paceWpm: 150,
      emphasisWords: ["前件", "差异", "留注"],
      breathBeforeMs: 420,
      pausesMs: [360, 520],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "lu-shengyan": {
    publicGoal: "在时限内让文书继续流转，并控制官署责任外溢。",
    privateMotive: "他希望显示处置果断，也怕一份可追溯记录暴露催办失当。",
    dailyPressure: "上级只看结果，书手却不断提交尚未解决的疑点。",
    moralBoundary: "他会要求权衡风险，但不允许下属伪造他的明确命令。",
    factionId: "jingzhao-officials",
    voiceDirection: {
      language: "zh-CN",
      register: "句式整齐、结论先行，不滥用典故或现代官腔。",
      emotion: "克制而施压",
      paceWpm: 162,
      emphasisWords: ["时限", "决定", "留注"],
      breathBeforeMs: 300,
      pausesMs: [260, 380],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "guo-wulang": {
    publicGoal: "取得明确递送范围，并在窗口关闭前完成递送。",
    privateMotive: "他不愿再替含混文书承担最终后果。",
    dailyPressure: "每次等待复核都压缩路上的时间。",
    moralBoundary: "他可以承担加急，却拒绝替别人改写经手时间。",
    factionId: "jingzhao-messengers",
    voiceDirection: {
      language: "zh-CN",
      register: "直接询问地点和时限，避免现代物流术语。",
      emotion: "急切而防备",
      paceWpm: 190,
      emphasisWords: ["送到哪里", "何时", "谁确认"],
      breathBeforeMs: 140,
      pausesMs: [160, 240],
      pronunciationStatus: "modern-mandarin",
    },
  },
  "du-suniang": {
    publicGoal: "让家庭提供的线索被听见，同时不让官署责任吞没日常生活。",
    privateMotive: "她怀疑家人的记忆会被轻视，也怕自己一句话造成误递。",
    dailyPressure: "家庭需要结果，官署却要求她提供无法独立证明的细节。",
    moralBoundary: "她会坚持自己的记忆，但不要求把记忆直接写成证据。",
    factionId: "clerk-household",
    voiceDirection: {
      language: "zh-CN",
      register: "温和而具体，叙述所见，不伪造女性专属语言模式。",
      emotion: "担忧而坚定",
      paceWpm: 160,
      emphasisWords: ["我记得", "待核", "家里"],
      breathBeforeMs: 360,
      pausesMs: [300, 460],
      pronunciationStatus: "modern-mandarin",
    },
  },
};

const locationClaimMap: Record<string, string[]> = {
  "M-001": ["C-742-002", "C-742-005", "C-O01-001", "C-MER-001"],
  "M-002": ["C-742-003", "C-742-005", "C-742-003", "C-742-005"],
  "M-003": ["C-742-004", "C-O03-001", "C-O03-002", "C-CLERK-001"],
  "M-004": ["C-742-006", "C-742-006", "C-742-006", "C-742-006"],
  "M-005": ["C-742-002", "C-O02-001", "C-CRAFT-001", "C-CRAFT-002"],
  "M-006": ["C-742-007", "C-742-002", "C-O02-001", "C-CRAFT-002"],
  "M-007": ["C-742-008", "C-742-003", "C-742-008", "C-742-003"],
  "M-008": ["C-742-009", "C-O03-001", "C-CLERK-001", "C-CLERK-002"],
};

function relationshipBands(npcId: string): Phase11ProductionNpc["relationshipBands"] {
  return [
    { band: "hostile", informationIds: [`${npcId}-public-role`] },
    { band: "guarded", informationIds: [`${npcId}-public-role`, `${npcId}-boundary`] },
    { band: "neutral", informationIds: [`${npcId}-routine`, `${npcId}-public-goal`] },
    { band: "cooperative", informationIds: [`${npcId}-routine`, `${npcId}-daily-pressure`] },
    { band: "confidant", informationIds: [`${npcId}-daily-pressure`, `${npcId}-private-motive`] },
  ];
}

function buildNpcs(): Phase11ProductionNpc[] {
  return phase11Content.npcs.map((npc) => {
    const profile = npcProfiles[npc.id];
    if (!profile) throw new Error(`phase11 production missing NPC profile ${npc.id}`);
    return npcProductionSchema.parse({
      npcId: npc.id,
      ...profile,
      relationshipBands: relationshipBands(npc.id),
      historicalClaimIds: npc.claimIds,
      publicationStatus: "provisional",
    });
  });
}

function axisEffect(
  operation: "increase" | "decrease" | "no_change",
  path: string | null,
  rationale: string,
): z.infer<typeof axisEffectSchema> {
  return axisEffectSchema.parse({
    operation,
    canonicalStatePaths: path ? [path] : [],
    rationale,
  });
}

function reputationPath(originId: "merchant" | "craft" | "clerk"): string {
  if (originId === "merchant") return "worldState.reputation.market";
  if (originId === "clerk") return "worldState.reputation.administration";
  return "worldState.reputation.household";
}

function buildSocialEffects(
  event: (typeof phase11Content.events)[number],
): Phase11ProductionEvent["socialEffects"] {
  return event.choices.map((choice) => {
    const hasRelationship = choice.stateEffects.includes("relationship");
    const hasReputation = choice.stateEffects.includes("reputation");
    const hasSkill = choice.stateEffects.includes("skill");
    const relationshipOperation = !hasRelationship
      ? "no_change"
      : choice.risk === "high"
        ? "decrease"
        : "increase";
    const prestigeOperation = hasReputation
      ? choice.risk === "high"
        ? "decrease"
        : "increase"
      : hasSkill && choice.risk === "low"
        ? "increase"
        : "no_change";
    const factionOperation = hasRelationship
      ? relationshipOperation
      : hasReputation
        ? prestigeOperation
        : "no_change";

    return socialEffectSchema.parse({
      choiceId: choice.id,
      accessBand: axisEffect(
        relationshipOperation,
        hasRelationship ? "worldState.relationships" : null,
        hasRelationship
          ? `该选项通过已登记的关系变化投影场景准入；风险级别为${choice.risk}。`
          : "该选项没有登记关系变化，因此不改变场景准入。",
      ),
      prestigeBand: axisEffect(
        prestigeOperation,
        hasReputation
          ? reputationPath(event.originId)
          : hasSkill
            ? "worldState.skills"
            : null,
        hasReputation
          ? "该选项通过已登记的声誉变化投影社会评价。"
          : hasSkill
            ? "该选项只在低风险且技能确有变化时提升专业评价。"
            : "该选项没有声誉或技能依据，因此不改变社会评价。",
      ),
      factionPosture: axisEffect(
        factionOperation,
        hasRelationship
          ? "worldState.relationships"
          : hasReputation
            ? reputationPath(event.originId)
            : null,
        hasRelationship || hasReputation
          ? "阵营态度只从既有关系或声誉字段派生，不新增隐藏数据库字段。"
          : "没有关系或声誉变化时，阵营态度保持不变。",
      ),
    });
  });
}

function eventEvidence(eventId: string, fallback: string[]): string[] {
  const linked = phase11CitationLinks
    .filter((link) => link.eventId === eventId)
    .map((link) => link.sourceId);
  const combined = [...new Set([...fallback, ...linked])];
  if (combined.length < 3) {
    throw new Error(`phase11 production event ${eventId} has fewer than three source links`);
  }
  return combined;
}

function buildEvents(): Phase11ProductionEvent[] {
  return phase11Content.events.map((event) => {
    const scene = phase11CinematicScenes.find((candidate) => candidate.eventId === event.eventId);
    const line = phase11Content.voiceLines.find((candidate) => candidate.eventId === event.eventId);
    if (!scene || !line) throw new Error(`phase11 production missing scene or line for ${event.eventId}`);
    const nextEventId = event.choices.find((choice) => choice.nextEventId)?.nextEventId;
    const nextEvent = nextEventId
      ? phase11Content.events.find((candidate) => candidate.eventId === nextEventId)
      : null;
    const narrativeRole =
      event.phase === "consequence"
        ? "consequence"
        : event.sequence === 4
          ? "social-vignette"
          : event.sequence === 6
            ? "hidden-world"
            : "main";

    return eventProductionSchema.parse({
      eventId: event.eventId,
      narrativeRole,
      dramaticBeats: {
        setup: event.premise,
        complication: `冲突由${event.npcIds.map((id) =>
          phase11Content.npcs.find((npc) => npc.id === id)?.nameZh ?? id
        ).join("、")}的责任与信息边界推进；不能由镜头或模型另加事实。`,
        decision: `玩家必须在“${event.choices.map((choice) => choice.label).join("”“")}”之间作出一次可追溯选择。`,
        aftermath: `登记后果依次为：${event.choices.map((choice) => choice.result).join("；")}`,
        foreshadowing: nextEvent
          ? `下一事件“${nextEvent.title}”只读取已提交的关系、声誉、风险和时间变化。`
          : "章节以三种编辑结局收束，并生成可重玩的责任回顾。",
      },
      socialEffects: buildSocialEffects(event),
      clueIds: event.claimIds.map((claimId) =>
        `clue-${event.eventId}-${claimId.toLowerCase().replace(/[^a-z0-9-]/g, "")}`
      ),
      dialogueLineIds: [line.id],
      cinematicCueIds: [scene.id],
      audioCueIds: [`audio-${event.originId}-${event.sequence}`],
      evidenceRefs: eventEvidence(event.eventId, event.evidenceRefs),
      publicationStatus: "provisional",
    });
  });
}

function buildLocations(): Phase11ProductionLocation[] {
  const batchLocations = batchPlanJson.locations;
  const layers = ["surface", "concealed", "relational", "surface"] as const;
  const verbs = ["observe", "compare", "ask", "trace"] as const;

  return batchLocations.map((batchLocation) => {
    const feature = changanContent.mapFeatures.find(
      (candidate) => candidate.id === batchLocation.mapFeatureId,
    );
    if (!feature) throw new Error(`phase11 production missing map feature ${batchLocation.mapFeatureId}`);
    const claimIds = locationClaimMap[feature.id];
    if (!claimIds || claimIds.length !== 4) {
      throw new Error(`phase11 production location ${feature.id} needs four claim mappings`);
    }

    const clues = claimIds.map((claimId, index) => {
      const claim = changanContent.claims.find((candidate) => candidate.id === claimId);
      if (!claim || claim.sourceIds.length === 0) {
        throw new Error(`phase11 production clue ${feature.id}/${claimId} lacks sourced claim`);
      }
      const locatorNotes = claim.sourceIds.map((sourceId) => {
        const source = changanContent.sources.find((candidate) => candidate.id === sourceId);
        if (!source) throw new Error(`phase11 production missing source ${sourceId}`);
        return `${sourceId}: ${source.locator}`;
      });
      return clueSchema.parse({
        clueId: `clue-${feature.id.toLowerCase()}-${index + 1}`,
        layer: layers[index],
        classification: claim.classification,
        claimIds: [claim.id],
        sourceIds: claim.sourceIds,
        locatorNotes,
        interactionVerb: verbs[index],
        uncertaintyNote: `${feature.uncertaintyNoteZh} 本线索只表达声明 ${claim.id} 的最小结论。`,
      });
    });

    return locationProductionSchema.parse({
      mapFeatureId: feature.id,
      runtimeLocationId: batchLocation.runtimeLocationId,
      clues,
      timeStates: ["morning", "day", "dusk", "night"],
      establishingShotId: `establish-${batchLocation.runtimeLocationId}`,
      environmentAudioIds: [
        `ambience-${batchLocation.runtimeLocationId}-day`,
        `ambience-${batchLocation.runtimeLocationId}-night`,
      ],
      uncertaintyNote: `${feature.uncertaintyNoteZh} 坐标系为 ${feature.geometry.coordinateSystem}；授权为 ${feature.licenseCode}。`,
      sourceIds: feature.sourceIds,
      publicationStatus: "provisional",
    });
  });
}

export const phase11ProductionBundle: Phase11ProductionBundle =
  phase11ProductionBundleSchema.parse({
    contentVersion: batchPlanJson.contentVersion,
    scenarioId: batchPlanJson.scenarioId,
    publicationStatus: batchPlanJson.publicationStatus,
    stateAuthority: batchPlanJson.stateAuthority,
    unityStatus: batchPlanJson.unityStatus,
    events: buildEvents(),
    npcs: buildNpcs(),
    locations: buildLocations(),
    assetManifest: [
      {
        assetId: "phase11-cinematic-cue-registry",
        domain: "fx",
        format: "json",
        licenseCode: "Project-authored",
        sourceIds: [],
        classification: "叙事虚构",
        reviewStatus: "approved",
      },
      {
        assetId: "phase11-caption-registry",
        domain: "ui",
        format: "json",
        licenseCode: "Project-authored",
        sourceIds: [],
        classification: "叙事虚构",
        reviewStatus: "approved",
      },
      {
        assetId: "phase11-device-voice-directions",
        domain: "audio",
        format: "json",
        licenseCode: "Project-authored",
        sourceIds: [],
        classification: "叙事虚构",
        reviewStatus: "approved",
      },
    ],
  });
