import { z } from "zod";

export const originIdSchema = z.enum(["merchant", "craft", "clerk"]);
export type OriginId = z.infer<typeof originIdSchema>;

export const historicalClassificationSchema = z.enum(["史料记载", "合理重建", "叙事虚构"]);
export type HistoricalClassification = z.infer<typeof historicalClassificationSchema>;

export const gameTimeSchema = z.object({
  year: z.literal(742),
  season: z.enum(["spring", "summer", "autumn", "winter"]),
  dayOfYear: z.number().int().min(1).max(365),
  minuteOfDay: z.number().int().min(0).max(1439),
  totalMinutes: z.number().int().min(0).max(525599),
  turn: z.number().int().nonnegative(),
}).strict();

export const locationSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
}).strict();

const boundedIdSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const decisionSummarySchema = z.object({
  eventId: boundedIdSchema,
  choiceId: z.string().regex(/^choice-[1-5]$/),
  consequenceKey: boundedIdSchema,
  summary: z.string().min(3).max(240),
  turn: z.number().int().positive(),
}).strict();

export const relationshipMemorySchema = z.object({
  relationshipId: boundedIdSchema,
  eventId: boundedIdSchema,
  summary: z.string().min(3).max(240),
  valence: z.enum(["negative", "neutral", "positive"]),
  turn: z.number().int().positive(),
}).strict();

export const riskClockSchema = z.object({
  id: boundedIdSchema,
  label: z.string().min(1).max(120),
  progress: z.number().int().min(0).max(12),
  threshold: z.number().int().min(1).max(12),
  status: z.enum(["inactive", "active", "triggered", "resolved"]),
}).strict();

export const chapterEndingSchema = z.object({
  id: boundedIdSchema,
  title: z.string().min(2).max(120),
  summary: z.string().min(20).max(500),
  classification: historicalClassificationSchema,
  sourceIds: z.array(z.string().regex(/^S-[0-9]{3}$/)).min(1).max(8),
}).strict();

export const storyStateSchema = z.object({
  chapterId: boundedIdSchema,
  currentEventId: boundedIdSchema,
  completedEventIds: z.array(boundedIdSchema).max(40),
  decisions: z.array(decisionSummarySchema).max(40),
  relationshipMemories: z.array(relationshipMemorySchema).max(80),
  riskClocks: z.array(riskClockSchema).max(20),
  chapterEnding: chapterEndingSchema.nullable(),
}).strict();

export const worldStateSchema = z.object({
  time: gameTimeSchema,
  location: locationSchema,
  health: z.object({
    condition: z.enum(["stable", "strained", "ill", "critical", "dead"]),
    vitality: z.number().int().min(0).max(10),
  }).strict(),
  socialIdentity: originIdSchema,
  occupation: z.string().min(1).max(120).nullable(),
  money: z.object({
    cash: z.number().int().nonnegative().max(100000),
    unit: z.literal("文（游戏记账单位）"),
  }).strict(),
  items: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(80),
    quantity: z.number().int().min(1).max(99),
  }).strict()).max(40),
  relationships: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(80),
    affinity: z.number().int().min(-10).max(10),
  }).strict()).max(30),
  reputation: z.object({
    household: z.number().int().min(-10).max(10),
    market: z.number().int().min(-10).max(10),
    administration: z.number().int().min(-10).max(10),
  }).strict(),
  skills: z.object({
    memory: z.number().int().min(1).max(10),
    reasoning: z.number().int().min(1).max(10),
    socialJudgment: z.number().int().min(1).max(10),
    professionalPotential: z.number().int().min(1).max(10),
    physical: z.number().int().min(1).max(10),
    luck: z.number().int().min(1).max(10),
  }).strict(),
  quests: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(120),
    status: z.enum(["active", "completed", "failed"]),
  }).strict()).max(20),
  risks: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(120),
  }).strict()).max(20),
  death: z.object({
    cause: z.string().min(1).max(160),
    trigger: z.string().min(1).max(240),
    classification: z.literal("叙事虚构"),
  }).strict().nullable(),
  story: storyStateSchema,
}).strict();

export type WorldState = z.infer<typeof worldStateSchema>;

export const turnActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("choice"),
    choiceId: z.string().regex(/^choice-[1-5]$/),
    text: z.string().min(1).max(500),
  }).strict(),
  z.object({
    kind: z.literal("free_text"),
    text: z.string().min(1).max(1000),
  }).strict(),
  z.object({
    kind: z.literal("image"),
    uploadId: z.string().uuid(),
    text: z.string().max(500),
  }).strict(),
]);

export type TurnAction = z.infer<typeof turnActionSchema>;

export const turnRequestSchema = z.object({
  clientTurnId: z.string().uuid(),
  expectedStateVersion: z.number().int().nonnegative(),
  action: turnActionSchema,
}).strict();

export type TurnRequest = z.infer<typeof turnRequestSchema>;

export const turnChoiceSchema = z.object({
  id: z.string().regex(/^choice-[1-5]$/),
  label: z.string().min(3).max(120),
  intent: z.string().min(3).max(200),
  risk: z.enum(["low", "medium", "high"]),
}).strict();

export type TurnChoice = z.infer<typeof turnChoiceSchema>;

export const stateDeltaSchema = z.object({
  minutesElapsed: z.number().int().min(5).max(180),
  location: locationSchema.nullable(),
  occupation: z.string().min(1).max(120).nullable(),
  moneyDelta: z.number().int().min(-100).max(100),
  healthDelta: z.number().int().min(-2).max(1),
  healthCondition: z.enum(["stable", "strained", "ill", "critical", "dead"]).nullable(),
  addItems: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(80),
    quantity: z.number().int().min(1).max(3),
  }).strict()).max(2),
  removeItemIds: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(2),
  relationshipDeltas: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(80),
    delta: z.number().int().min(-2).max(2),
  }).strict()).max(2),
  reputationDeltas: z.object({
    household: z.number().int().min(-2).max(2),
    market: z.number().int().min(-2).max(2),
    administration: z.number().int().min(-2).max(2),
  }).strict(),
  skillDeltas: z.object({
    memory: z.number().int().min(0).max(1),
    reasoning: z.number().int().min(0).max(1),
    socialJudgment: z.number().int().min(0).max(1),
    professionalPotential: z.number().int().min(0).max(1),
    physical: z.number().int().min(0).max(1),
    luck: z.number().int().min(0).max(1),
  }).strict(),
  addQuests: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(120),
  }).strict()).max(1),
  completeQuestIds: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(1),
  addRisks: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,60}$/),
    label: z.string().min(1).max(120),
  }).strict()).max(2),
  resolveRiskIds: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(2),
  death: z.object({
    cause: z.string().min(1).max(160),
    trigger: z.string().min(1).max(240),
    classification: z.literal("叙事虚构"),
  }).strict().nullable(),
}).strict();

export type StateDelta = z.infer<typeof stateDeltaSchema>;

export const ruleExpressionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("origin_is"), originId: originIdSchema }).strict(),
  z.object({ kind: z.literal("turn_between"), min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("location_is"), locationId: boundedIdSchema }).strict(),
  z.object({ kind: z.literal("money_at_least"), amount: z.number().int().nonnegative() }).strict(),
  z.object({
    kind: z.literal("relationship_at_least"),
    relationshipId: boundedIdSchema,
    affinity: z.number().int().min(-10).max(10),
  }).strict(),
  z.object({
    kind: z.literal("risk_clock_at_least"),
    riskId: boundedIdSchema,
    progress: z.number().int().min(0).max(12),
  }).strict(),
  z.object({
    kind: z.literal("quest_status"),
    questId: boundedIdSchema,
    status: z.enum(["missing", "active", "completed", "failed"]),
  }).strict(),
]);

export type RuleExpression = z.infer<typeof ruleExpressionSchema>;

export const consequenceSchema = z.object({
  key: boundedIdSchema,
  summary: z.string().min(3).max(240),
  stateDelta: stateDeltaSchema,
  relationshipMemories: z.array(z.object({
    relationshipId: boundedIdSchema,
    summary: z.string().min(3).max(240),
    valence: z.enum(["negative", "neutral", "positive"]),
  }).strict()).max(4),
  riskClockDeltas: z.array(z.object({
    id: boundedIdSchema,
    label: z.string().min(1).max(120),
    delta: z.number().int().min(-4).max(4),
    threshold: z.number().int().min(1).max(12),
    resolve: z.boolean(),
  }).strict()).max(4),
  nextEventId: boundedIdSchema.nullable(),
  ending: chapterEndingSchema.nullable(),
}).strict();

export type Consequence = z.infer<typeof consequenceSchema>;

export const choiceTemplateSchema = z.object({
  id: z.string().regex(/^choice-[1-5]$/),
  label: z.string().min(3).max(120),
  intent: z.string().min(3).max(200),
  risk: z.enum(["low", "medium", "high"]),
  consequence: consequenceSchema,
}).strict();

export const eventTemplateSchema = z.object({
  eventId: boundedIdSchema,
  chapterId: boundedIdSchema,
  originIds: z.array(originIdSchema).min(1).max(3),
  title: z.string().min(2).max(120),
  classification: historicalClassificationSchema,
  prerequisites: z.array(ruleExpressionSchema).max(12),
  choices: z.array(choiceTemplateSchema).min(3).max(5),
  freeTextChoiceId: z.string().regex(/^choice-[1-5]$/),
  evidenceRefs: z.array(z.string().regex(/^S-[0-9]{3}$/)).min(1).max(8),
  publicationStatus: z.enum(["draft", "provisional", "reviewed", "published"]),
  runtimeAvailability: z.enum(["disabled", "public-beta", "public"]).default("public"),
}).strict();

export type EventTemplate = z.infer<typeof eventTemplateSchema>;

export const scenarioManifestSchema = z.object({
  scenarioId: z.literal("tang-changan-742"),
  contentVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
  era: z.object({ start: z.literal(742), end: z.literal(742) }).strict(),
  locations: z.array(boundedIdSchema).min(1),
  origins: z.array(originIdSchema).length(3),
  evidencePolicy: z.literal("source_required"),
  firstEventByOrigin: z.record(originIdSchema, boundedIdSchema),
}).strict();

export type ScenarioManifest = z.infer<typeof scenarioManifestSchema>;

export const narrativeExpressionSchema = z.object({
  title: z.string().min(2).max(80),
  text: z.string().min(80).max(1800),
  choiceVariants: z.array(z.object({
    id: z.string().regex(/^choice-[1-5]$/),
    label: z.string().min(3).max(120),
    intent: z.string().min(3).max(200),
  }).strict()).max(5),
  sourceIds: z.array(z.string().regex(/^S-[0-9]{3}$/)).min(1).max(8),
}).strict();

export type NarrativeExpression = z.infer<typeof narrativeExpressionSchema>;

export const turnGenerationSchema = z.object({
  eventId: boundedIdSchema.optional(),
  resolvedChoiceId: z.string().regex(/^choice-[1-5]$/).optional(),
  consequenceKey: boundedIdSchema.optional(),
  narrative: z.object({
    title: z.string().min(2).max(80),
    text: z.string().min(80).max(1800),
    classification: historicalClassificationSchema,
  }).strict(),
  choices: z.array(turnChoiceSchema).max(5),
  stateDelta: stateDeltaSchema,
  sourceIds: z.array(z.string().regex(/^S-[0-9]{3}$/)).min(1).max(8),
}).strict();

export type TurnGeneration = z.infer<typeof turnGenerationSchema>;

export const evidenceClaimSchema = z.object({
  id: z.string(),
  classification: historicalClassificationSchema,
  text: z.string(),
  sourceIds: z.array(z.string()),
}).strict();

export const evidenceSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  creator: z.string(),
  locator: z.string(),
  licenseCode: z.string(),
}).strict();

export type EvidenceClaim = z.infer<typeof evidenceClaimSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

export const replaySummarySchema = z.object({
  sessionId: z.string().uuid(),
  chapterId: boundedIdSchema,
  decisions: z.array(decisionSummarySchema),
  changedRelations: z.array(z.object({
    relationshipId: boundedIdSchema,
    label: z.string().min(1).max(80),
    affinity: z.number().int().min(-10).max(10),
    memoryCount: z.number().int().nonnegative(),
  }).strict()),
  unresolvedRisks: z.array(riskClockSchema),
  ending: chapterEndingSchema.nullable(),
  nextEntryPoint: z.string().min(1).max(160),
}).strict();

export type ReplaySummary = z.infer<typeof replaySummarySchema>;

export const committedTurnSchema = z.object({
  turnId: z.string().uuid(),
  stateVersion: z.number().int().positive(),
  worldState: worldStateSchema,
  narrative: turnGenerationSchema,
  duplicate: z.boolean(),
}).strict();

export type CommittedTurn = z.infer<typeof committedTurnSchema>;

export const turnStreamEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("turn.started"),
    data: z.object({
      clientTurnId: z.string().uuid(),
      stateVersion: z.number().int().nonnegative(),
      duplicate: z.boolean(),
    }).strict(),
  }).strict(),
  z.object({
    event: z.literal("narrative.delta"),
    data: z.object({
      delta: z.string(),
      sequence: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  z.object({
    event: z.literal("choices.ready"),
    data: z.object({
      choices: z.array(turnChoiceSchema).max(5),
      sourceIds: z.array(z.string()),
      classification: historicalClassificationSchema,
    }).strict(),
  }).strict(),
  z.object({
    event: z.literal("state.committed"),
    data: committedTurnSchema,
  }).strict(),
  z.object({
    event: z.literal("turn.failed"),
    data: z.object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
      notCommitted: z.literal(true),
    }).strict(),
  }).strict(),
]);

export type TurnStreamEvent = z.infer<typeof turnStreamEventSchema>;
