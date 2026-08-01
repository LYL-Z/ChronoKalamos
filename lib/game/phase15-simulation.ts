import { getEventTemplate } from "@/lib/game/event-catalog";
import type { OriginId, WorldState } from "@/lib/game/schemas";

export const phase15ModuleIds = [
  "map",
  "attributes",
  "inventory",
  "relations",
  "livelihood",
  "quests",
  "household",
] as const;

export type Phase15ModuleId = (typeof phase15ModuleIds)[number];

export type DayCycleState = {
  dayIndex: number;
  usedSlots: number;
  remainingSlots: number;
  closesAfterNextAction: boolean;
  settlementLabel: string;
};

export type SocialPosition = {
  stratum: "平民" | "胥吏";
  standingLabel: string;
  institutionalAccess: string;
  evidenceBoundary: string;
};

export type ModuleDescriptor = {
  id: Phase15ModuleId;
  shortcut: string | null;
  label: string;
  eyebrow: string;
  count: number;
  summary: string;
  empty: boolean;
};

export type ChoiceDisclosure = {
  actionSlots: 1;
  minutes: number;
  risk: "low" | "medium" | "high";
  moneyCost: number | null;
  affectedDomains: string[];
  note: string;
};

const originPositions: Record<OriginId, SocialPosition> = {
  merchant: {
    stratum: "平民",
    standingLabel: "西市商户家户成员",
    institutionalAccess: "市场、家户与跨地域商贸关系",
    evidenceBoundary: "不是官员或贵族身份；当前切片不提供朝政权限。",
  },
  craft: {
    stratum: "平民",
    standingLabel: "长安工匠家庭学徒",
    institutionalAccess: "作坊、师徒关系与家户营生",
    evidenceBoundary: "工匠生活细节含合理重建；不得外推为全唐统一工役制度。",
  },
  clerk: {
    stratum: "胥吏",
    standingLabel: "京兆基层文书家户成员",
    institutionalAccess: "基层文书、差遣与行政关系",
    evidenceBoundary: "胥吏不等于品官；当前切片不提供任官、朝会或全国调度。",
  },
};

export function getDayCycleState(state: WorldState): DayCycleState {
  const usedSlots = state.time.turn % 3;
  const remainingSlots = 3 - usedSlots;
  return {
    dayIndex: Math.floor(state.time.turn / 3) + 1,
    usedSlots,
    remainingSlots,
    closesAfterNextAction: remainingSlots === 1,
    settlementLabel: usedSlots === 0 && state.time.turn > 0
      ? "上一日已结算；精力恢复"
      : remainingSlots === 1
        ? "下一行动后日结"
        : `本日尚余 ${remainingSlots} 个行动位`,
  };
}

export function getSocialPosition(state: WorldState): SocialPosition {
  return originPositions[state.socialIdentity];
}

export function getModuleDescriptors(state: WorldState): ModuleDescriptor[] {
  const activeRisks = state.story.riskClocks.filter((risk) => risk.status !== "resolved");
  const activeQuests = state.quests.filter((quest) => quest.status === "active");
  const relationshipCount = new Set([
    ...state.relationships.map((relationship) => relationship.id),
    ...state.story.relationshipMemories.map((memory) => memory.relationshipId),
  ]).size;

  return [
    {
      id: "map",
      shortcut: "M",
      label: "地图",
      eyebrow: "EVIDENCE MAP",
      count: 8,
      summary: "已发布证据地点与当前事件位置",
      empty: false,
    },
    {
      id: "attributes",
      shortcut: "P",
      label: "属性",
      eyebrow: "CHARACTER",
      count: Object.keys(state.skills).length,
      summary: "天赋、健康、精力与社会位置",
      empty: false,
    },
    {
      id: "inventory",
      shortcut: "B",
      label: "背包",
      eyebrow: "INVENTORY",
      count: state.items.reduce((sum, item) => sum + item.quantity, 0),
      summary: state.items.length ? "当前权威存档中的持有物" : "尚无已提交物品",
      empty: state.items.length === 0,
    },
    {
      id: "relations",
      shortcut: "R",
      label: "关系",
      eyebrow: "RELATIONS",
      count: relationshipCount,
      summary: relationshipCount ? "关系数值与已提交记忆" : "关系将在事件后形成",
      empty: relationshipCount === 0,
    },
    {
      id: "livelihood",
      shortcut: null,
      label: state.socialIdentity === "clerk" ? "公务" : "营生",
      eyebrow: "DUTY",
      count: 1,
      summary: state.occupation ?? "当前职业未定",
      empty: !state.occupation,
    },
    {
      id: "quests",
      shortcut: "J",
      label: "任务",
      eyebrow: "DUTIES & RISKS",
      count: activeQuests.length + activeRisks.length,
      summary: `${activeQuests.length} 项任务 · ${activeRisks.length} 个风险钟`,
      empty: activeQuests.length + activeRisks.length === 0,
    },
    {
      id: "household",
      shortcut: null,
      label: "家户",
      eyebrow: "HOUSEHOLD",
      count: state.story.relationshipMemories.filter((memory) =>
        memory.relationshipId.includes("family") || memory.relationshipId.includes("household")
      ).length,
      summary: `${originPositions[state.socialIdentity].standingLabel} · 家户声望 ${state.reputation.household}`,
      empty: false,
    },
  ];
}

export function getChoiceDisclosure(
  state: WorldState,
  choiceId: string,
  contentVersion: string,
): ChoiceDisclosure {
  const event = getEventTemplate(state.story.currentEventId, contentVersion);
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`choice_not_found:${choiceId}`);
  const delta = choice.consequence.stateDelta;
  const affectedDomains = [
    delta.moneyDelta !== 0 ? "钱财" : null,
    delta.healthDelta !== 0 || delta.healthCondition ? "健康" : null,
    delta.relationshipDeltas.length > 0 ? "关系" : null,
    Object.values(delta.reputationDeltas).some((value) => value !== 0) ? "声望" : null,
    Object.values(delta.skillDeltas).some((value) => value !== 0) ? "能力" : null,
    delta.addItems.length > 0 || delta.removeItemIds.length > 0 ? "物品" : null,
    delta.addQuests.length > 0 || delta.completeQuestIds.length > 0 ? "任务" : null,
    delta.addRisks.length > 0
      || delta.resolveRiskIds.length > 0
      || choice.consequence.riskClockDeltas.length > 0
      ? "风险"
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    actionSlots: 1,
    minutes: delta.minutesElapsed,
    risk: choice.risk,
    moneyCost: delta.moneyDelta < 0 ? Math.abs(delta.moneyDelta) : null,
    affectedDomains,
    note: "只披露编辑模板声明的方向，不展示隐藏事件或完整数值后果。",
  };
}
