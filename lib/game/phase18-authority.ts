import {
  authoritativeSystemActionRequestSchema,
  authoritativeSystemEventSchema,
  worldStateSchema,
  type AuthoritativeSystemActionId,
  type AuthoritativeSystemActionRequest,
  type AuthoritativeSystemEvent,
  type SystemApproach,
  type WorldState,
} from "@/lib/game/schemas";
import { phase17Circuits, phase17Endings, phase17ItemCatalog } from "@/lib/game/phase17-world";

export const PHASE18_RULESET_VERSION = "18.0.0" as const;

type ActionDefinition = {
  id: AuthoritativeSystemActionId;
  title: string;
  domain: "household" | "office" | "casework" | "commerce" | "elite" | "governance" | "ending";
  classification: "合理重建" | "叙事虚构";
  sourceIds: string[];
  description: string;
};

export const phase18ActionCatalog: ActionDefinition[] = [
  { id: "confirm-adult-age", title: "确认角色年龄", domain: "household", classification: "叙事虚构", sourceIds: ["S-008"], description: "由玩家确认角色年龄。未确认成年前，婚姻入口保持关闭。" },
  { id: "household-care", title: "安排家户照护", domain: "household", classification: "叙事虚构", sourceIds: ["S-008"], description: "分配照护与家计，不把婚育当作强制成长线。" },
  { id: "marriage-contract", title: "订立婚书", domain: "household", classification: "叙事虚构", sourceIds: ["S-008"], description: "仅记录成年、明确同意的架空婚约。" },
  { id: "register-child-care", title: "登记子女照护", domain: "household", classification: "叙事虚构", sourceIds: ["S-008"], description: "只记录照护关系，不推断生育能力或血缘事实。" },
  { id: "study-records", title: "研读制度簿籍", domain: "office", classification: "合理重建", sourceIds: ["S-002", "S-008"], description: "积累文书与官署制度资格。" },
  { id: "case-open", title: "立案登记", domain: "casework", classification: "合理重建", sourceIds: ["S-002", "S-008"], description: "建立可追踪案卷，不先写结论。" },
  { id: "case-investigate", title: "核验案卷证据", domain: "casework", classification: "合理重建", sourceIds: ["S-002", "S-008"], description: "增加一项经规则登记的证据。" },
  { id: "case-resolve", title: "形成案卷处分", domain: "casework", classification: "叙事虚构", sourceIds: ["S-002", "S-008"], description: "把处分写入架空案卷，不冒充真实判牍。" },
  { id: "office-appoint", title: "接受试任官职", domain: "office", classification: "叙事虚构", sourceIds: ["S-002", "S-008"], description: "授予架空试任，不改变742年真实任官名录。" },
  { id: "office-duty", title: "办理官职公务", domain: "office", classification: "叙事虚构", sourceIds: ["S-002", "S-008"], description: "按现有官职权限处理一项公务。" },
  { id: "trade-buy", title: "购入物品", domain: "commerce", classification: "合理重建", sourceIds: ["S-004"], description: "按游戏账面值购入目录物品。账面值不是742年物价表。" },
  { id: "trade-sell", title: "售出物品", domain: "commerce", classification: "合理重建", sourceIds: ["S-004"], description: "按游戏账面值的八成结算一件物品。" },
  { id: "workshop-production", title: "完成作坊工序", domain: "commerce", classification: "合理重建", sourceIds: ["S-008"], description: "记录一次可追责的工序产出。" },
  { id: "elite-introduction", title: "取得高门引见", domain: "elite", classification: "叙事虚构", sourceIds: ["S-008"], description: "通过既有公务、交易与家户信用取得一次架空引见。" },
  { id: "elite-council", title: "参加高门议事", domain: "elite", classification: "叙事虚构", sourceIds: ["S-008"], description: "开启高门网络权限，但不把士族、宗室和勋贵混作同一历史类别。" },
  { id: "governance-accession", title: "开启全国治理分支", domain: "governance", classification: "叙事虚构", sourceIds: ["S-001", "S-008"], description: "显式开启架空治理分支；不改写玄宗朝真实历史。" },
  { id: "governance-revenue", title: "复核全国度支", domain: "governance", classification: "叙事虚构", sourceIds: ["S-001", "S-008"], description: "调整的是游戏治理指标，不是742年国库统计。" },
  { id: "governance-relief", title: "裁定赈济优先级", domain: "governance", classification: "叙事虚构", sourceIds: ["S-001", "S-008"], description: "用财政、秩序与信任的权衡形成架空政策后果。" },
  { id: "prepare-departure", title: "准备离开长安", domain: "household", classification: "叙事虚构", sourceIds: ["S-003", "S-007"], description: "登记离城准备与未解决风险。" },
  { id: "conclude-chapter", title: "封存本章结局", domain: "ending", classification: "叙事虚构", sourceIds: ["S-001", "S-008"], description: "只有满足结局条件时才可封存。" },
];

const actionById = new Map(phase18ActionCatalog.map((entry) => [entry.id, entry]));
const endingById = new Map(phase17Endings.map((entry) => [entry.id, entry]));

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function completedQuest(state: WorldState, id: string, label: string): WorldState["quests"] {
  const existing = state.quests.find((quest) => quest.id === id);
  if (existing) {
    return state.quests.map((quest) => quest.id === id ? { ...quest, status: "completed" as const } : quest);
  }
  return [...state.quests, { id, label, status: "completed" as const }].slice(0, 20);
}

function advanceTime(state: WorldState): Pick<WorldState, "time" | "energy"> {
  const nextTurn = state.time.turn + 1;
  const closesDay = nextTurn % 3 === 0;
  const absolute = ((state.time.dayOfYear - 1) * 1440) + state.time.minuteOfDay;
  const nextAbsolute = closesDay ? state.time.dayOfYear * 1440 + 360 : absolute + 30;
  const dayOfYear = Math.floor(nextAbsolute / 1440) + 1;
  if (dayOfYear > 365) throw new Error("scenario_time_boundary");
  const season = dayOfYear <= 92 ? "spring" : dayOfYear <= 184 ? "summer" : dayOfYear <= 276 ? "autumn" : "winter";
  return {
    time: {
      year: 742,
      season,
      dayOfYear,
      minuteOfDay: nextAbsolute % 1440,
      totalMinutes: nextAbsolute - 360,
      turn: nextTurn,
    },
    energy: {
      current: closesDay ? state.energy.max : Math.max(0, state.energy.current - 1),
      max: state.energy.max,
    },
  };
}

function addLegacy(state: WorldState, approach: SystemApproach): WorldState["systems"]["legacy"] {
  return {
    ...state.systems.legacy,
    [approach]: clamp(state.systems.legacy[approach] + 1, 0, 100),
  };
}

function addItem(state: WorldState, itemId: string): WorldState["items"] {
  const catalog = phase17ItemCatalog.find((entry) => entry.id === itemId);
  if (!catalog) throw new Error("system_item_unknown");
  const existing = state.items.find((entry) => entry.id === itemId);
  if (existing) {
    return state.items.map((entry) => entry.id === itemId
      ? { ...entry, quantity: Math.min(99, entry.quantity + 1) }
      : entry);
  }
  if (state.items.length >= 40) throw new Error("system_inventory_full");
  return [...state.items, { id: itemId, label: catalog.name, quantity: 1 }];
}

function removeItem(state: WorldState, itemId: string): WorldState["items"] {
  const existing = state.items.find((entry) => entry.id === itemId);
  if (!existing) throw new Error("system_item_not_owned");
  return existing.quantity === 1
    ? state.items.filter((entry) => entry.id !== itemId)
    : state.items.map((entry) => entry.id === itemId ? { ...entry, quantity: entry.quantity - 1 } : entry);
}

const toneByIndex: Record<string, SystemApproach> = {
  "01": "prudent",
  "02": "opportunity",
  "03": "cost",
  "04": "disorder",
  "05": "aftermath",
};

function endingGroupEligible(state: WorldState, group: string): boolean {
  if (group === "survival") return state.systems.household.standing >= 1;
  if (group === "market") return state.systems.commerce.completedTrades >= 1;
  if (group === "craft") return state.systems.commerce.workshopOutput >= 1;
  if (group === "clerical") return state.systems.casework.resolvedCount >= 1;
  if (group === "literati") return state.systems.office.qualification >= 2;
  if (group === "official") return Boolean(state.systems.office.appointment) && state.systems.office.dutyCompleted >= 1;
  if (group === "elite") return state.systems.eliteNetwork.councilAccess;
  if (group === "sovereign") return state.systems.governance.access && state.systems.governance.policyCount >= 1;
  if (group === "family") return state.systems.household.marriageStatus === "contracted" || state.systems.household.children >= 1;
  return (state.systems.actionCounts["prepare-departure"] ?? 0) >= 1;
}

export function getPhase18EndingEligibility(state: WorldState, endingId: string): { eligible: boolean; reason: string } {
  const ending = endingById.get(endingId);
  if (!ending) return { eligible: false, reason: "未知结局。" };
  const tone = toneByIndex[endingId.slice(-2)];
  if (!tone) return { eligible: false, reason: "结局语气合同无效。" };
  if (!endingGroupEligible(state, ending.group)) return { eligible: false, reason: "尚未完成该结局组的权威事件链。" };
  if (state.systems.legacy[tone] < 2) return { eligible: false, reason: `“${tone}”后果轨迹至少需要2次已提交行动。` };
  return { eligible: true, reason: "结局条件已满足。" };
}

function requireAction(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

export function applyAuthoritativeSystemAction(
  stateInput: WorldState,
  requestInput: AuthoritativeSystemActionRequest,
): { nextState: WorldState; event: AuthoritativeSystemEvent } {
  const state = worldStateSchema.parse(stateInput);
  const request = authoritativeSystemActionRequestSchema.parse(requestInput);
  const definition = actionById.get(request.actionId);
  if (!definition) throw new Error("system_action_unknown");
  if (state.death || state.story.chapterEnding || state.systems.activeEndingId) throw new Error("system_session_ended");
  if (state.energy.current <= 0 && state.time.turn % 3 !== 2) throw new Error("energy_depleted");

  const timed = advanceTime(state);
  let next: WorldState = worldStateSchema.parse({
    ...state,
    ...timed,
    systems: {
      ...state.systems,
      legacy: addLegacy(state, request.approach),
      actionCounts: {
        ...state.systems.actionCounts,
        [request.actionId]: (state.systems.actionCounts[request.actionId] ?? 0) + 1,
      },
    },
  });
  const consequences: string[] = [];

  if (request.actionId === "confirm-adult-age") {
    requireAction(request.parameters.actorAge, "actor_age_required");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, household: { ...next.systems.household, actorAge: request.parameters.actorAge } } });
    consequences.push(`角色年龄已确认为 ${request.parameters.actorAge} 岁`);
  } else if (request.actionId === "household-care") {
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, household: { ...next.systems.household, standing: clamp(next.systems.household.standing + 1, 0, 20) } }, reputation: { ...next.reputation, household: clamp(next.reputation.household + 1, -10, 10) } });
    consequences.push("家户声望 +1", "照护事务已登记");
  } else if (request.actionId === "marriage-contract") {
    requireAction((next.systems.household.actorAge ?? 0) >= 18, "actor_adulthood_unconfirmed");
    requireAction(next.systems.household.standing >= 1, "household_standing_required");
    requireAction(next.systems.household.marriageStatus === "unmarried", "marriage_already_contracted");
    requireAction(request.parameters.partnerLabel && request.parameters.partnerAge && request.parameters.mutualConsent, "mutual_adult_consent_required");
    const contractId = `marriage-${request.clientActionId.slice(0, 8)}`;
    next = worldStateSchema.parse({
      ...next,
      systems: {
        ...next.systems,
        household: {
          ...next.systems.household,
          standing: clamp(next.systems.household.standing + 2, 0, 20),
          marriageStatus: "contracted",
          marriageContractId: contractId,
          members: [...next.systems.household.members, {
            id: `spouse-${request.clientActionId.slice(0, 8)}`,
            label: request.parameters.partnerLabel,
            relation: "spouse",
            age: request.parameters.partnerAge,
            consentRecorded: true,
            careStatus: "independent",
            classification: "叙事虚构",
          }],
        },
      },
    });
    consequences.push("成年与双方同意已记录", "婚书已进入家户状态");
  } else if (request.actionId === "register-child-care") {
    requireAction(next.systems.household.marriageStatus === "contracted", "marriage_contract_required");
    requireAction(request.parameters.childLabel && request.parameters.childAge !== undefined, "child_care_record_required");
    requireAction(next.systems.household.children < 8, "child_care_capacity_reached");
    next = worldStateSchema.parse({
      ...next,
      systems: {
        ...next.systems,
        household: {
          ...next.systems.household,
          standing: clamp(next.systems.household.standing + 1, 0, 20),
          children: next.systems.household.children + 1,
          members: [...next.systems.household.members, {
            id: `child-${request.clientActionId.slice(0, 8)}`,
            label: request.parameters.childLabel,
            relation: "child",
            age: request.parameters.childAge,
            consentRecorded: false,
            careStatus: "priority-care",
            classification: "叙事虚构",
          }],
        },
      },
    });
    consequences.push("子女照护对象 +1", "不记录生育能力评分");
  } else if (request.actionId === "study-records") {
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, office: { ...next.systems.office, qualification: clamp(next.systems.office.qualification + 1, 0, 20) } }, quests: completedQuest(next, "stratum-literati-approved", "完成制度簿籍研习") });
    consequences.push("官署资格 +1");
  } else if (request.actionId === "case-open") {
    requireAction(next.systems.office.qualification >= 1, "office_qualification_required");
    requireAction(!next.systems.casework.cases.some((entry) => entry.status !== "resolved"), "active_case_exists");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, casework: { ...next.systems.casework, cases: [...next.systems.casework.cases, { id: `case-${request.clientActionId.slice(0, 8)}`, title: "簿籍差异案（架空）", status: "opened", evidenceCount: 0, disposition: null }] } } });
    consequences.push("案卷已立案");
  } else if (request.actionId === "case-investigate") {
    const active = next.systems.casework.cases.find((entry) => entry.status !== "resolved");
    requireAction(active, "active_case_required");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, casework: { ...next.systems.casework, cases: next.systems.casework.cases.map((entry) => entry.id === active.id ? { ...entry, status: "investigating" as const, evidenceCount: Math.min(12, entry.evidenceCount + 1) } : entry) } } });
    consequences.push("案卷证据 +1");
  } else if (request.actionId === "case-resolve") {
    const active = next.systems.casework.cases.find((entry) => entry.status === "investigating" && entry.evidenceCount >= 1);
    requireAction(active, "case_evidence_required");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, casework: { cases: next.systems.casework.cases.map((entry) => entry.id === active.id ? { ...entry, status: "resolved" as const, disposition: "按已登记证据形成架空处分，并保留复核入口。" } : entry), resolvedCount: next.systems.casework.resolvedCount + 1 }, office: { ...next.systems.office, qualification: clamp(next.systems.office.qualification + 1, 0, 20) } } });
    consequences.push("案卷已结", "官署资格 +1");
  } else if (request.actionId === "office-appoint") {
    requireAction(next.systems.office.qualification >= 2 && next.systems.casework.resolvedCount >= 1, "appointment_prerequisites_missing");
    requireAction(!next.systems.office.appointment, "office_already_appointed");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, office: { ...next.systems.office, appointment: { officeId: "jingzhao-trial-records", institution: "京兆府（架空分支）", title: "文案试任", rankLabel: "试任·品秩待定", classification: "叙事虚构" } }, }, occupation: "京兆府文案试任（架空）", quests: completedQuest(next, "stratum-official-appointed", "取得架空试任官职") });
    consequences.push("官职已进入 WorldState", "流内权限以架空试任标注");
  } else if (request.actionId === "office-duty") {
    requireAction(next.systems.office.appointment, "office_appointment_required");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, office: { ...next.systems.office, dutyCompleted: next.systems.office.dutyCompleted + 1, merit: clamp(next.systems.office.merit + 1, -20, 100) } }, reputation: { ...next.reputation, administration: clamp(next.reputation.administration + 1, -10, 10) } });
    consequences.push("公务完成 +1", "行政声望 +1");
  } else if (request.actionId === "trade-buy") {
    const item = phase17ItemCatalog.find((entry) => entry.id === request.parameters.itemId);
    requireAction(item, "system_item_unknown");
    requireAction(next.money.cash >= item.ledgerValue, "insufficient_funds");
    next = worldStateSchema.parse({ ...next, money: { ...next.money, cash: next.money.cash - item.ledgerValue }, items: addItem(next, item.id), systems: { ...next.systems, commerce: { ...next.systems.commerce, completedTrades: next.systems.commerce.completedTrades + 1, turnover: next.systems.commerce.turnover + item.ledgerValue } } });
    consequences.push(`钱财 -${item.ledgerValue}`, `${item.name} +1`);
  } else if (request.actionId === "trade-sell") {
    const item = phase17ItemCatalog.find((entry) => entry.id === request.parameters.itemId);
    requireAction(item, "system_item_unknown");
    const proceeds = Math.max(1, Math.floor(item.ledgerValue * 0.8));
    next = worldStateSchema.parse({ ...next, money: { ...next.money, cash: Math.min(100000, next.money.cash + proceeds) }, items: removeItem(next, item.id), systems: { ...next.systems, commerce: { ...next.systems.commerce, completedTrades: next.systems.commerce.completedTrades + 1, turnover: next.systems.commerce.turnover + proceeds } } });
    consequences.push(`钱财 +${proceeds}`, `${item.name} -1`);
  } else if (request.actionId === "workshop-production") {
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, commerce: { ...next.systems.commerce, workshopOutput: next.systems.commerce.workshopOutput + 1 } }, reputation: { ...next.reputation, market: clamp(next.reputation.market + 1, -10, 10) } });
    consequences.push("工序产出 +1", "市场声望 +1");
  } else if (request.actionId === "elite-introduction") {
    requireAction(next.systems.household.standing >= 2 && next.systems.office.dutyCompleted >= 1 && next.systems.commerce.completedTrades >= 1, "elite_introduction_prerequisites_missing");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, eliteNetwork: { ...next.systems.eliteNetwork, introductions: next.systems.eliteNetwork.introductions + 1, standing: clamp(next.systems.eliteNetwork.standing + 1, 0, 20) } } });
    consequences.push("高门引见 +1");
  } else if (request.actionId === "elite-council") {
    requireAction(next.systems.eliteNetwork.introductions >= 1, "elite_introduction_required");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, eliteNetwork: { ...next.systems.eliteNetwork, councilAccess: true, standing: clamp(next.systems.eliteNetwork.standing + 1, 0, 20) } }, quests: completedQuest(next, "stratum-elite-recognized", "进入架空高门议事网络") });
    consequences.push("高门议事权限已开启");
  } else if (request.actionId === "governance-accession") {
    requireAction(next.systems.eliteNetwork.councilAccess && next.systems.office.dutyCompleted >= 1, "governance_access_prerequisites_missing");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, governance: { ...next.systems.governance, access: true } }, quests: completedQuest(next, "stratum-sovereign-accession", "开启架空全国治理权限") });
    consequences.push("全国治理权限已开启", "明确标记为叙事虚构");
  } else if (request.actionId === "governance-revenue") {
    requireAction(next.systems.governance.access, "governance_access_required");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, governance: { ...next.systems.governance, treasury: clamp(next.systems.governance.treasury + 2, 0, 100), publicTrust: clamp(next.systems.governance.publicTrust - 1, 0, 100), policyCount: next.systems.governance.policyCount + 1 } } });
    consequences.push("国库指标 +2", "民信指标 -1");
  } else if (request.actionId === "governance-relief") {
    requireAction(next.systems.governance.access, "governance_access_required");
    const circuitId = request.parameters.circuitId ?? "capital";
    requireAction(phase17Circuits.some((entry) => entry.id === circuitId), "circuit_unknown");
    requireAction(next.systems.governance.treasury >= 3, "governance_treasury_low");
    next = worldStateSchema.parse({ ...next, systems: { ...next.systems, governance: { ...next.systems.governance, treasury: next.systems.governance.treasury - 3, publicTrust: clamp(next.systems.governance.publicTrust + 2, 0, 100), relief: clamp(next.systems.governance.relief + 3, 0, 100), policyCount: next.systems.governance.policyCount + 1, reviewedCircuits: [...new Set([...next.systems.governance.reviewedCircuits, circuitId])] } } });
    consequences.push("国库指标 -3", "民信指标 +2", `${circuitId} 已复核`);
  } else if (request.actionId === "prepare-departure") {
    next = worldStateSchema.parse({ ...next, risks: next.risks.some((entry) => entry.id === "departure-uncertainty") ? next.risks : [...next.risks, { id: "departure-uncertainty", label: "离城后的生计与关系尚未解决" }] });
    consequences.push("离城准备已登记", "未解决风险 +1");
  } else {
    const endingId = request.parameters.endingId;
    requireAction(endingId, "ending_id_required");
    const eligibility = getPhase18EndingEligibility(next, endingId);
    requireAction(eligibility.eligible, `ending_not_reachable:${eligibility.reason}`);
    const ending = endingById.get(endingId)!;
    next = worldStateSchema.parse({
      ...next,
      systems: { ...next.systems, activeEndingId: endingId },
      story: {
        ...next.story,
        chapterEnding: {
          id: endingId,
          title: ending.title,
          summary: `${ending.summary} 该结局由 Phase 18 规则状态触发，不代表真实历史。`,
          classification: "叙事虚构",
          sourceIds: definition.sourceIds,
        },
      },
    });
    consequences.push(`结局已封存：${ending.title}`);
  }

  const event = authoritativeSystemEventSchema.parse({
    actionId: request.actionId,
    title: definition.title,
    summary: `${definition.description} 本次结果由规则引擎计算并等待数据库事务提交。`,
    classification: definition.classification,
    sourceIds: definition.sourceIds,
    consequenceLabels: consequences,
    endingId: next.systems.activeEndingId,
  });
  return { nextState: next, event };
}

export function canApplyAuthoritativeSystemAction(
  state: WorldState,
  actionId: AuthoritativeSystemActionId,
  parameters: AuthoritativeSystemActionRequest["parameters"] = {},
): { allowed: boolean; reason: string } {
  try {
    applyAuthoritativeSystemAction(state, {
      clientActionId: "00000000-0000-4000-8000-000000000001",
      expectedStateVersion: state.time.turn,
      actionId,
      approach: "prudent",
      parameters,
    });
    return { allowed: true, reason: "可提交" };
  } catch (error) {
    const code = error instanceof Error ? error.message : "system_rule_rejected";
    const labels: Record<string, string> = {
      actor_age_required: "请输入18至80岁的角色年龄",
      actor_adulthood_unconfirmed: "请先确认角色成年年龄",
      household_standing_required: "先完成一次家户照护",
      mutual_adult_consent_required: "需填写成年婚约对象并确认双方同意",
      marriage_contract_required: "需先订立婚书",
      child_care_record_required: "需填写子女照护记录",
      office_qualification_required: "先研读一次制度簿籍",
      active_case_required: "需先立案",
      case_evidence_required: "需先核验证据",
      appointment_prerequisites_missing: "需完成两次研习与一宗案卷",
      office_appointment_required: "需先取得试任官职",
      elite_introduction_prerequisites_missing: "需家户声望、公务与交易三项前置",
      elite_introduction_required: "需先取得高门引见",
      governance_access_prerequisites_missing: "需先完成公务并进入高门议事",
      governance_access_required: "需先开启架空全国治理分支",
      system_item_unknown: "请选择目录物品",
      system_item_not_owned: "背包中没有该物品",
      ending_id_required: "请选择结局",
      energy_depleted: "本日行动点已用尽",
    };
    return { allowed: false, reason: labels[code] ?? code.replace(/^ending_not_reachable:/, "") };
  }
}

function request(
  actionId: AuthoritativeSystemActionId,
  approach: SystemApproach,
  parameters: AuthoritativeSystemActionRequest["parameters"] = {},
): AuthoritativeSystemActionRequest {
  return { clientActionId: crypto.randomUUID(), expectedStateVersion: 0, actionId, approach, parameters };
}

export function buildPhase18ReachabilityPlan(endingId: string): AuthoritativeSystemActionRequest[] {
  const ending = endingById.get(endingId);
  if (!ending) throw new Error("ending_unknown");
  const approach = toneByIndex[endingId.slice(-2)];
  const itemId = "p17-flatbread-ration";
  const age = () => request("confirm-adult-age", approach, { actorAge: 20 });
  const household = () => request("household-care", approach);
  const study = () => request("study-records", approach);
  const caseChain = () => [study(), study(), request("case-open", approach), request("case-investigate", approach), request("case-resolve", approach)];
  const officeChain = () => [...caseChain(), request("office-appoint", approach), request("office-duty", approach)];
  const tradeChain = () => [request("trade-buy", approach, { itemId }), request("trade-sell", approach, { itemId })];
  const eliteChain = () => [age(), household(), household(), ...officeChain(), ...tradeChain(), request("elite-introduction", approach), request("elite-council", approach)];
  let actions: AuthoritativeSystemActionRequest[];
  if (ending.group === "survival") actions = [age(), household()];
  else if (ending.group === "market") actions = [age(), ...tradeChain()];
  else if (ending.group === "craft") actions = [age(), request("workshop-production", approach)];
  else if (ending.group === "clerical") actions = [age(), ...caseChain()];
  else if (ending.group === "literati") actions = [age(), study(), study()];
  else if (ending.group === "official") actions = [age(), ...officeChain()];
  else if (ending.group === "elite") actions = eliteChain();
  else if (ending.group === "sovereign") actions = [...eliteChain(), request("governance-accession", approach), request("governance-revenue", approach)];
  else if (ending.group === "family") actions = [age(), household(), request("marriage-contract", approach, { partnerLabel: "婚约对象（架空）", partnerAge: 20, mutualConsent: true })];
  else actions = [age(), request("prepare-departure", approach)];
  return [...actions, request("conclude-chapter", approach, { endingId })];
}

export function executePhase18ReachabilityPlan(initialState: WorldState, endingId: string): WorldState {
  let state = worldStateSchema.parse(initialState);
  for (const [index, planned] of buildPhase18ReachabilityPlan(endingId).entries()) {
    const action = { ...planned, expectedStateVersion: state.time.turn, clientActionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` };
    state = applyAuthoritativeSystemAction(state, action).nextState;
  }
  return state;
}
