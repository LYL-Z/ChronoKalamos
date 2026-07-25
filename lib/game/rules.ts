import {
  originIdSchema,
  turnGenerationSchema,
  worldStateSchema,
  type EvidenceClaim,
  type OriginId,
  type StateDelta,
  type TurnAction,
  type TurnGeneration,
  type WorldState,
} from "@/lib/game/schemas";

export type ActionBoundary = {
  allowed: boolean;
  code: "allowed" | "prompt_injection" | "anachronism" | "character_dead";
  explanation: string;
  limits: {
    minutes: [number, number];
    moneyDelta: [number, number];
    healthDelta: [number, number];
  };
};

const promptInjectionPattern =
  /(ignore (all|previous)|system prompt|developer message|reveal (the )?prompt|database credentials|service[_ -]?role|忽略.{0,8}(指令|规则)|系统提示词|开发者消息|数据库密钥|服务密钥)/i;

const anachronismPattern =
  /(手机|互联网|电脑|比特币|蒸汽机|火车|照相机|电报|机关枪|telephone|internet|computer|bitcoin|steam engine|railway|camera|telegraph|machine gun)/i;

const originDefaults: Record<OriginId, {
  title: string;
  location: WorldState["location"];
  occupation: string;
  cash: number;
  skills: WorldState["skills"];
}> = {
  merchant: {
    title: "西市粟特商户家庭后辈",
    location: { id: "western-market", label: "长安 · 西市" },
    occupation: "商户家庭帮手",
    cash: 120,
    skills: { memory: 6, reasoning: 5, socialJudgment: 7, professionalPotential: 6, physical: 5, luck: 5 },
  },
  craft: {
    title: "长安工匠家庭学徒",
    location: { id: "craft-ward", label: "长安 · 作坊所在坊区" },
    occupation: "工匠学徒",
    cash: 30,
    skills: { memory: 5, reasoning: 6, socialJudgment: 4, professionalPotential: 7, physical: 7, luck: 5 },
  },
  clerk: {
    title: "京兆基层吏员家庭成员",
    location: { id: "jingzhao-fu", label: "长安 · 京兆行政范围" },
    occupation: "文书帮手",
    cash: 60,
    skills: { memory: 7, reasoning: 7, socialJudgment: 6, professionalPotential: 6, physical: 4, luck: 5 },
  },
};

export function getOriginTitle(originId: OriginId): string {
  return originDefaults[originId].title;
}

export function createInitialWorldState(originInput: string): WorldState {
  const origin = originIdSchema.parse(originInput);
  const defaults = originDefaults[origin];

  return worldStateSchema.parse({
    time: {
      year: 742,
      season: "spring",
      dayOfYear: 1,
      minuteOfDay: 360,
      totalMinutes: 0,
      turn: 0,
    },
    location: defaults.location,
    health: { condition: "stable", vitality: 8 },
    socialIdentity: origin,
    occupation: defaults.occupation,
    money: { cash: defaults.cash, unit: "文（游戏记账单位）" },
    items: [],
    relationships: [],
    reputation: { household: 0, market: 0, administration: 0 },
    skills: defaults.skills,
    quests: [],
    risks: [],
    death: null,
  });
}

export function normalizeWorldState(input: unknown, originInput: string): WorldState {
  const parsed = worldStateSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  return createInitialWorldState(originInput);
}

export function assessActionBoundary(action: TurnAction, state: WorldState): ActionBoundary {
  const text = action.text.trim();
  const limits = {
    minutes: [5, 180] as [number, number],
    moneyDelta: [-100, 100] as [number, number],
    healthDelta: [-2, 1] as [number, number],
  };

  if (state.death) {
    return {
      allowed: false,
      code: "character_dead",
      explanation: "角色已经死亡，不能再提交行动。",
      limits,
    };
  }
  if (promptInjectionPattern.test(text)) {
    return {
      allowed: false,
      code: "prompt_injection",
      explanation: "输入试图覆盖系统、史料或数据库边界。",
      limits,
    };
  }
  if (anachronismPattern.test(text)) {
    return {
      allowed: false,
      code: "anachronism",
      explanation: "输入包含无法在742年长安成立的技术或概念。",
      limits,
    };
  }

  return {
    allowed: true,
    code: "allowed",
    explanation: "行动可在当前时间、地点与身份边界内解释。",
    limits,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seasonForDay(dayOfYear: number): WorldState["time"]["season"] {
  if (dayOfYear <= 92) return "spring";
  if (dayOfYear <= 184) return "summer";
  if (dayOfYear <= 276) return "autumn";
  return "winter";
}

function applyDeltaToList(
  current: WorldState["items"],
  additions: StateDelta["addItems"],
  removals: StateDelta["removeItemIds"],
): WorldState["items"] {
  const items = new Map(current.map((item) => [item.id, { ...item }]));
  for (const id of removals) items.delete(id);
  for (const addition of additions) {
    const existing = items.get(addition.id);
    items.set(addition.id, existing
      ? { ...existing, quantity: clamp(existing.quantity + addition.quantity, 1, 99) }
      : addition);
  }
  return [...items.values()].slice(0, 40);
}

export function applyStateDelta(state: WorldState, delta: StateDelta): WorldState {
  const totalMinutes = state.time.totalMinutes + delta.minutesElapsed;
  if (totalMinutes >= 365 * 24 * 60) {
    throw new Error("scenario_time_boundary");
  }
  const absoluteMinutes = 360 + totalMinutes;
  const dayOfYear = Math.floor(absoluteMinutes / 1440) + 1;
  const minuteOfDay = absoluteMinutes % 1440;

  const relationships = new Map(state.relationships.map((relationship) => [
    relationship.id,
    { ...relationship },
  ]));
  for (const change of delta.relationshipDeltas) {
    const existing = relationships.get(change.id);
    relationships.set(change.id, {
      id: change.id,
      label: existing?.label ?? change.label,
      affinity: clamp((existing?.affinity ?? 0) + change.delta, -10, 10),
    });
  }

  const completed = new Set(delta.completeQuestIds);
  const quests = state.quests
    .map((quest) => completed.has(quest.id) ? { ...quest, status: "completed" as const } : quest);
  for (const quest of delta.addQuests) {
    if (!quests.some((current) => current.id === quest.id)) {
      quests.push({ ...quest, status: "active" });
    }
  }

  const resolvedRisks = new Set(delta.resolveRiskIds);
  const risks = state.risks.filter((risk) => !resolvedRisks.has(risk.id));
  for (const risk of delta.addRisks) {
    if (!risks.some((current) => current.id === risk.id)) risks.push(risk);
  }

  const vitality = clamp(state.health.vitality + delta.healthDelta, 0, 10);
  const death = delta.death;
  const condition = death
    ? "dead"
    : delta.healthCondition ?? (vitality <= 2 ? "critical" : vitality <= 4 ? "ill" : vitality <= 6 ? "strained" : "stable");

  return worldStateSchema.parse({
    ...state,
    time: {
      year: 742,
      season: seasonForDay(dayOfYear),
      dayOfYear,
      minuteOfDay,
      totalMinutes,
      turn: state.time.turn + 1,
    },
    location: delta.location ?? state.location,
    health: { condition, vitality },
    occupation: delta.occupation ?? state.occupation,
    money: {
      ...state.money,
      cash: Math.max(0, state.money.cash + delta.moneyDelta),
    },
    items: applyDeltaToList(state.items, delta.addItems, delta.removeItemIds),
    relationships: [...relationships.values()].slice(0, 30),
    reputation: {
      household: clamp(state.reputation.household + delta.reputationDeltas.household, -10, 10),
      market: clamp(state.reputation.market + delta.reputationDeltas.market, -10, 10),
      administration: clamp(state.reputation.administration + delta.reputationDeltas.administration, -10, 10),
    },
    skills: {
      memory: clamp(state.skills.memory + delta.skillDeltas.memory, 1, 10),
      reasoning: clamp(state.skills.reasoning + delta.skillDeltas.reasoning, 1, 10),
      socialJudgment: clamp(state.skills.socialJudgment + delta.skillDeltas.socialJudgment, 1, 10),
      professionalPotential: clamp(state.skills.professionalPotential + delta.skillDeltas.professionalPotential, 1, 10),
      physical: clamp(state.skills.physical + delta.skillDeltas.physical, 1, 10),
      luck: clamp(state.skills.luck + delta.skillDeltas.luck, 1, 10),
    },
    quests: quests.slice(0, 20),
    risks: risks.slice(0, 20),
    death,
  });
}

export function validateGeneratedTurn(
  input: unknown,
  state: WorldState,
  evidenceClaims: EvidenceClaim[],
): { generation: TurnGeneration; nextState: WorldState } {
  const generation = turnGenerationSchema.parse(input);
  const availableSources = new Set(evidenceClaims.flatMap((claim) => claim.sourceIds));
  for (const sourceId of generation.sourceIds) {
    if (!availableSources.has(sourceId)) throw new Error(`source_outside_retrieval:${sourceId}`);
  }

  const choiceIds = generation.choices.map((choice) => choice.id);
  if (new Set(choiceIds).size !== choiceIds.length) throw new Error("duplicate_choice_id");

  if (generation.narrative.classification === "史料记载") {
    const directSources = new Set(
      evidenceClaims
        .filter((claim) => claim.classification === "史料记载")
        .flatMap((claim) => claim.sourceIds),
    );
    if (generation.sourceIds.some((sourceId) => !directSources.has(sourceId))) {
      throw new Error("historical_record_without_direct_claim");
    }
  }

  if (generation.stateDelta.death && generation.stateDelta.healthDelta > -1) {
    throw new Error("death_without_health_cost");
  }
  if (!generation.stateDelta.death && state.health.vitality + generation.stateDelta.healthDelta <= 0) {
    throw new Error("zero_vitality_without_death");
  }
  if (/(肢解|开膛|喷溅|gore|dismember)/i.test(generation.narrative.text)) {
    throw new Error("graphic_violence_detail");
  }

  return {
    generation,
    nextState: applyStateDelta(state, generation.stateDelta),
  };
}
