import {
  eventTemplateSchema,
  scenarioManifestSchema,
  stateDeltaSchema,
  type EventTemplate,
  type ScenarioManifest,
  type StateDelta,
} from "@/lib/game/schemas";
import { phase11Content, type Phase11EventBeat } from "@/lib/historical/phase11";

const primaryRiskByOrigin = {
  merchant: "market-deadline",
  craft: "workshop-deadline",
  clerk: "dispatch-error",
} as const;

const reputationByOrigin = {
  merchant: "market",
  craft: "household",
  clerk: "administration",
} as const;

function npcLabel(id: string): string {
  return phase11Content.npcs.find((npc) => npc.id === id)?.nameZh ?? id;
}

function riskLabel(id: string): string {
  return phase11Content.risks.find((risk) => risk.id === id)?.labelZh ?? id;
}

function buildDelta(event: Phase11EventBeat, choice: Phase11EventBeat["choices"][number]): StateDelta {
  const has = (effect: string) => choice.stateEffects.includes(effect as never);
  const reputation = { household: 0, market: 0, administration: 0 };
  if (has("reputation")) {
    reputation[reputationByOrigin[event.originId]] = choice.risk === "high" ? -1 : 1;
  }

  const skills = {
    memory: 0,
    reasoning: 0,
    socialJudgment: 0,
    professionalPotential: 0,
    physical: 0,
    luck: 0,
  };
  if (has("skill")) {
    if (event.originId === "clerk") skills.memory = 1;
    else if (event.originId === "craft") skills.professionalPotential = 1;
    else skills.reasoning = 1;
  }

  return stateDeltaSchema.parse({
    minutesElapsed: choice.risk === "low" ? 30 : choice.risk === "medium" ? 25 : 15,
    location: null,
    occupation: null,
    moneyDelta: has("money") ? (choice.risk === "high" ? -12 : -8) : 0,
    healthDelta: has("health") ? -1 : 0,
    healthCondition: has("health") ? "strained" : null,
    addItems: [],
    removeItemIds: [],
    relationshipDeltas: has("relationship")
      ? [{
        id: event.npcIds[0],
        label: npcLabel(event.npcIds[0]),
        delta: choice.risk === "high" ? -1 : 1,
      }]
      : [],
    reputationDeltas: reputation,
    skillDeltas: skills,
    addQuests: [],
    completeQuestIds: [],
    addRisks: [],
    resolveRiskIds: [],
    death: null,
  });
}

function buildEvent(event: Phase11EventBeat): EventTemplate {
  const riskId = primaryRiskByOrigin[event.originId];
  const isEnding = event.phase === "ending";
  return eventTemplateSchema.parse({
    eventId: event.eventId,
    chapterId: event.chapterId,
    originIds: [event.originId],
    title: event.title,
    classification: event.classification,
    prerequisites: [
      { kind: "origin_is", originId: event.originId },
      { kind: "turn_between", min: event.sequence - 1, max: event.sequence - 1 },
      ...(event.sequence === 1
        ? [{ kind: "location_is" as const, locationId: event.locationId }]
        : []),
    ],
    choices: event.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      intent: choice.intent,
      risk: choice.risk,
      consequence: {
        key: `${event.eventId}-${choice.id}`,
        summary: choice.result,
        stateDelta: buildDelta(event, choice),
        relationshipMemories: choice.stateEffects.includes("relationship")
          ? [{
            relationshipId: event.npcIds[0],
            summary: `${npcLabel(event.npcIds[0])}记住了你在“${event.title}”中的选择。`,
            valence: choice.risk === "high" ? "negative" : choice.risk === "low" ? "positive" : "neutral",
          }]
          : [],
        riskClockDeltas: choice.stateEffects.includes("risk") || isEnding
          ? [{
            id: riskId,
            label: riskLabel(riskId),
            delta: isEnding ? -4 : choice.risk === "high" ? 2 : choice.risk === "medium" ? 1 : -1,
            threshold: 6,
            resolve: isEnding,
          }]
          : [],
        nextEventId: choice.nextEventId,
        ending: isEnding
          ? {
            id: `${event.chapterId}-${choice.id}-ending`,
            title: event.title,
            summary: `${choice.result} 该结局只描述本次虚构角色经历，不代表742年长安同类人群的普遍选择。`,
            classification: "叙事虚构",
            sourceIds: event.evidenceRefs,
          }
          : null,
      },
    })),
    freeTextChoiceId: "choice-1",
    evidenceRefs: event.evidenceRefs,
    publicationStatus: event.publicationStatus,
  });
}

export const phase11CandidateManifest: ScenarioManifest = scenarioManifestSchema.parse({
  scenarioId: "tang-changan-742",
  contentVersion: "11.0.0",
  era: { start: 742, end: 742 },
  locations: [
    "western-market",
    "jin-guang-gate",
    "jingzhao-fu",
    "daming-palace",
    "ward-grid",
    "eastern-market",
    "mingde-gate",
    "imperial-city",
  ],
  origins: ["merchant", "craft", "clerk"],
  evidencePolicy: "source_required",
  firstEventByOrigin: {
    merchant: "merchant-ledger-mark",
    craft: "craft-material-shortfall",
    clerk: "clerk-ambiguous-place",
  },
});

export const phase11CandidateEventTemplates: EventTemplate[] =
  phase11Content.events.map(buildEvent);

const eventIndex = new Map(
  phase11CandidateEventTemplates.map((event) => [event.eventId, event]),
);

export function getPhase11CandidateEventTemplate(eventId: string): EventTemplate {
  const event = eventIndex.get(eventId);
  if (!event) throw new Error(`phase11_candidate_event_not_found:${eventId}`);
  return event;
}
