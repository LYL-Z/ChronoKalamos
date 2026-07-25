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

export const turnGenerationSchema = z.object({
  narrative: z.object({
    title: z.string().min(2).max(80),
    text: z.string().min(80).max(1800),
    classification: historicalClassificationSchema,
  }).strict(),
  choices: z.array(turnChoiceSchema).min(3).max(5),
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
      choices: z.array(turnChoiceSchema).min(3).max(5),
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
