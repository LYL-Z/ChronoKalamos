import { getRuntimeCatalog } from "@/lib/game/event-catalog";
import type { OriginId, WorldState } from "@/lib/game/schemas";

export type Phase16Cycle = {
  dayIndex: number;
  xunIndex: number;
  dayWithinXun: number;
  completedDays: number;
  label: string;
};

export type Phase16Goal = {
  id: string;
  label: string;
  detail: string;
  progress: number;
  target: number;
  complete: boolean;
};

export type Phase16Achievement = {
  id: string;
  label: string;
  detail: string;
  unlocked: boolean;
};

export type Phase16Progression = {
  cycle: Phase16Cycle;
  goals: Phase16Goal[];
  achievements: Phase16Achievement[];
  completedEvents: number;
  totalOriginEvents: number;
  completedGoals: number;
};

export type Phase16SettlementChange = {
  id: string;
  label: string;
  delta: number;
  tone: "positive" | "negative" | "neutral";
};

const originGoalCopy: Record<OriginId, {
  record: string;
  standing: string;
  relation: string;
}> = {
  merchant: {
    record: "核清往来",
    standing: "稳住市信",
    relation: "留下见证",
  },
  craft: {
    record: "完成工序记录",
    standing: "守住家户信誉",
    relation: "建立师徒记忆",
  },
  clerk: {
    record: "办结文书节点",
    standing: "维持行政信用",
    relation: "留下同僚见证",
  },
};

function clampProgress(value: number, target: number): number {
  return Math.min(target, Math.max(0, value));
}

function relevantReputation(state: WorldState): number {
  if (state.socialIdentity === "merchant") return state.reputation.market;
  if (state.socialIdentity === "clerk") return state.reputation.administration;
  return state.reputation.household;
}

function makeGoal(
  id: string,
  label: string,
  detail: string,
  progress: number,
  target: number,
): Phase16Goal {
  const bounded = clampProgress(progress, target);
  return { id, label, detail, progress: bounded, target, complete: bounded >= target };
}

export function getPhase16Cycle(state: WorldState): Phase16Cycle {
  const dayIndex = Math.floor(state.time.turn / 3) + 1;
  const completedDays = Math.floor(state.time.turn / 3);
  const xunIndex = Math.floor((dayIndex - 1) / 10) + 1;
  const dayWithinXun = ((dayIndex - 1) % 10) + 1;
  return {
    dayIndex,
    xunIndex,
    dayWithinXun,
    completedDays,
    label: `模拟旬期 ${xunIndex} · 第 ${dayWithinXun}/10 日`,
  };
}

export function getPhase16Progression(
  state: WorldState,
  contentVersion: string,
): Phase16Progression {
  const catalog = getRuntimeCatalog(contentVersion);
  const originEvents = catalog.events.filter((event) => event.originIds.includes(state.socialIdentity));
  const originEventIds = new Set(originEvents.map((event) => event.eventId));
  const completedEvents = state.story.completedEventIds.filter((id) => originEventIds.has(id)).length;
  const positiveMemories = state.story.relationshipMemories.filter((memory) => memory.valence === "positive").length;
  const copy = originGoalCopy[state.socialIdentity];
  const goals = [
    makeGoal(
      "three-records",
      copy.record,
      "完成三个由规则提交的事件节点。",
      completedEvents,
      3,
    ),
    makeGoal(
      "standing-two",
      copy.standing,
      "把当前身份对应的声望维持到 2。",
      relevantReputation(state),
      2,
    ),
    makeGoal(
      "two-positive-memories",
      copy.relation,
      "形成两条正向、可回溯到事件的关系记忆。",
      positiveMemories,
      2,
    ),
  ];
  const cycle = getPhase16Cycle(state);
  const hasResolvedRisk = state.story.riskClocks.some((risk) => risk.status === "resolved");
  const hasTriggeredRisk = state.story.riskClocks.some((risk) => risk.status === "triggered");
  const achievements: Phase16Achievement[] = [
    {
      id: "first-record",
      label: "第一笔记录",
      detail: "完成一次权威回合提交。",
      unlocked: state.time.turn >= 1,
    },
    {
      id: "day-closed",
      label: "一日有据",
      detail: "完成三个行动并通过同一事务日结。",
      unlocked: cycle.completedDays >= 1,
    },
    {
      id: "five-records",
      label: "案牍成列",
      detail: "完成五个本出身事件节点。",
      unlocked: completedEvents >= 5,
    },
    {
      id: "relationship-memory",
      label: "有人记得",
      detail: "形成第一条已提交关系记忆。",
      unlocked: state.story.relationshipMemories.length >= 1,
    },
    {
      id: "risk-contained",
      label: "风险归档",
      detail: "通过编辑规则解决一个风险钟。",
      unlocked: hasResolvedRisk,
    },
    {
      id: "bounded-three",
      label: "边界内行事",
      detail: "完成三个节点，且没有风险钟进入触发状态。",
      unlocked: completedEvents >= 3 && !hasTriggeredRisk,
    },
    {
      id: "chapter-ended",
      label: "一章落款",
      detail: "抵达当前出身的章节结局。",
      unlocked: Boolean(state.story.chapterEnding),
    },
  ];

  return {
    cycle,
    goals,
    achievements,
    completedEvents,
    totalOriginEvents: originEvents.length,
    completedGoals: goals.filter((goal) => goal.complete).length,
  };
}

function totalItemQuantity(state: WorldState): number {
  return state.items.reduce((total, item) => total + item.quantity, 0);
}

function totalRelationshipAffinity(state: WorldState): number {
  return state.relationships.reduce((total, relation) => total + relation.affinity, 0);
}

function totalRiskProgress(state: WorldState): number {
  return state.story.riskClocks.reduce((total, risk) => total + risk.progress, 0);
}

export function getPhase16SettlementChanges(
  previousState: WorldState | null,
  state: WorldState,
): Phase16SettlementChange[] {
  if (!previousState) return [];
  const candidates = [
    ["money", "钱财", state.money.cash - previousState.money.cash],
    ["energy", "精力", state.energy.current - previousState.energy.current],
    ["health", "健康", state.health.vitality - previousState.health.vitality],
    ["morale", "士气", state.morale - previousState.morale],
    ["household-reputation", "家户声望", state.reputation.household - previousState.reputation.household],
    ["market-reputation", "市井声望", state.reputation.market - previousState.reputation.market],
    ["administration-reputation", "行政声望", state.reputation.administration - previousState.reputation.administration],
    ["items", "持有物", totalItemQuantity(state) - totalItemQuantity(previousState)],
    ["relations", "关系", totalRelationshipAffinity(state) - totalRelationshipAffinity(previousState)],
    ["risk", "风险进度", totalRiskProgress(state) - totalRiskProgress(previousState)],
  ] as const;

  return candidates
    .filter(([, , delta]) => delta !== 0)
    .map(([id, label, delta]) => ({
      id,
      label,
      delta,
      tone: id === "risk"
        ? (delta > 0 ? "negative" : "positive")
        : (delta > 0 ? "positive" : "negative"),
    }));
}
