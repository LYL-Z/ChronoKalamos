import { z } from "zod";
import chaptersJson from "@/content/tang-changan-742/chapters.json";
import eventsJson from "@/content/tang-changan-742/events.json";
import itemsJson from "@/content/tang-changan-742/items.json";
import npcsJson from "@/content/tang-changan-742/npcs.json";
import publicationGateJson from "@/content/tang-changan-742/publication-gate.json";
import risksJson from "@/content/tang-changan-742/risks.json";
import {
  changanContent,
  classificationSchema,
  publicationStatusSchema,
} from "@/lib/historical/content";

const boundedIdSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const sourceIdSchema = z.string().regex(/^S-\d{3}$/);
const claimIdSchema = z.string().regex(/^C-[A-Z0-9-]+$/);
const originIdSchema = z.enum(["merchant", "craft", "clerk"]);
const provisionalSchema = z.literal("provisional");

export const phase11PublicationGateSchema = z.object({
  scenarioId: z.literal("tang-changan-742"),
  candidateContentVersion: z.literal("11.0.0"),
  runtimeFallbackVersion: z.literal("10.0.0"),
  externalReviewRequired: z.literal(true),
  reviewStatus: z.enum(["pending", "changes-requested", "approved"]),
  reviewers: z.array(z.object({
    name: z.string().min(1),
    affiliation: z.string().min(1),
    reviewedAt: z.string().datetime(),
    scope: z.string().min(1),
    decision: z.enum(["changes-requested", "approved"]),
    evidenceArtifact: z.string().min(1),
  }).strict()),
  publicRuntimeEnabled: z.boolean(),
  minimumReviewerCount: z.number().int().min(1),
  releaseRule: z.string().min(20),
}).strict();

export const phase11NpcSchema = z.object({
  id: boundedIdSchema,
  originId: originIdSchema,
  nameZh: z.string().min(2).max(40),
  roleZh: z.string().min(2).max(60),
  function: z.string().min(8).max(160),
  classification: z.literal("叙事虚构"),
  claimIds: z.array(claimIdSchema).min(1),
  sourceIds: z.array(sourceIdSchema).max(0),
  publicationStatus: provisionalSchema,
}).strict();

export const phase11ItemSchema = z.object({
  id: boundedIdSchema,
  originId: originIdSchema,
  nameZh: z.string().min(2).max(60),
  function: z.string().min(8).max(160),
  classification: z.literal("合理重建"),
  claimIds: z.array(claimIdSchema).min(1),
  sourceIds: z.array(sourceIdSchema).min(1),
  publicationStatus: provisionalSchema,
}).strict();

export const phase11RiskSchema = z.object({
  id: boundedIdSchema,
  originId: originIdSchema,
  labelZh: z.string().min(2).max(60),
  descriptionZh: z.string().min(10).max(180),
  threshold: z.number().int().min(1).max(12),
  classification: z.literal("合理重建"),
  claimIds: z.array(claimIdSchema).min(1),
  sourceIds: z.array(sourceIdSchema).min(1),
  publicationStatus: provisionalSchema,
}).strict();

const phase11ChoiceSchema = z.object({
  id: z.string().regex(/^choice-[1-3]$/),
  label: z.string().min(3).max(120),
  intent: z.string().min(3).max(160),
  risk: z.enum(["low", "medium", "high"]),
  result: z.string().min(8).max(180),
  stateEffects: z.array(z.enum([
    "skill",
    "relationship",
    "risk",
    "reputation",
    "money",
    "health",
    "item",
  ])).min(1),
  nextEventId: boundedIdSchema.nullable(),
}).strict();

export const phase11EventBeatSchema = z.object({
  eventId: boundedIdSchema,
  chapterId: boundedIdSchema,
  originId: originIdSchema,
  sequence: z.number().int().min(1).max(9),
  phase: z.enum(["opening", "core", "consequence", "ending"]),
  title: z.string().min(2).max(120),
  premise: z.string().min(20).max(500),
  classification: classificationSchema,
  locationId: boundedIdSchema,
  npcIds: z.array(boundedIdSchema).min(1).max(4),
  claimIds: z.array(claimIdSchema).min(1).max(8),
  evidenceRefs: z.array(sourceIdSchema).min(1).max(8),
  choices: z.array(phase11ChoiceSchema).length(3),
  publicationStatus: provisionalSchema,
}).strict();

export const phase11ChapterSchema = z.object({
  id: boundedIdSchema,
  originId: originIdSchema,
  title: z.string().min(2).max(120),
  summary: z.string().min(20).max(300),
  eventIds: z.array(boundedIdSchema).length(9),
  npcIds: z.array(boundedIdSchema).min(4),
  locationIds: z.array(boundedIdSchema).min(1),
  claimIds: z.array(claimIdSchema).min(1),
  publicationStatus: provisionalSchema,
}).strict();

export type Phase11PublicationGate = z.infer<typeof phase11PublicationGateSchema>;
export type Phase11Npc = z.infer<typeof phase11NpcSchema>;
export type Phase11Item = z.infer<typeof phase11ItemSchema>;
export type Phase11Risk = z.infer<typeof phase11RiskSchema>;
export type Phase11EventBeat = z.infer<typeof phase11EventBeatSchema>;
export type Phase11Chapter = z.infer<typeof phase11ChapterSchema>;

export type Phase11Content = {
  gate: Phase11PublicationGate;
  chapters: Phase11Chapter[];
  events: Phase11EventBeat[];
  npcs: Phase11Npc[];
  items: Phase11Item[];
  risks: Phase11Risk[];
};

const locationEvidence = new Map([
  ["western-market", "M-001"],
  ["jin-guang-gate", "M-002"],
  ["jingzhao-fu", "M-003"],
  ["craft-ward", "M-005"],
  ["daming-palace", "M-004"],
  ["ward-grid", "M-005"],
  ["eastern-market", "M-006"],
  ["mingde-gate", "M-007"],
  ["imperial-city", "M-008"],
]);

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate IDs`);
  }
}

function assertReferences(values: string[], known: Set<string>, owner: string, kind: string) {
  for (const value of values) {
    if (!known.has(value)) throw new Error(`${owner} references missing ${kind} ${value}`);
  }
}

export function validatePhase11Content(input: {
  gate: unknown;
  chapters: unknown;
  events: unknown;
  npcs: unknown;
  items: unknown;
  risks: unknown;
}): Phase11Content {
  const gate = phase11PublicationGateSchema.parse(input.gate);
  const chapters = z.array(phase11ChapterSchema).parse(input.chapters);
  const events = z.array(phase11EventBeatSchema).parse(input.events);
  const npcs = z.array(phase11NpcSchema).parse(input.npcs);
  const items = z.array(phase11ItemSchema).parse(input.items);
  const risks = z.array(phase11RiskSchema).parse(input.risks);

  assertUnique(chapters.map((chapter) => chapter.id), "phase11 chapters");
  assertUnique(events.map((event) => event.eventId), "phase11 events");
  assertUnique(npcs.map((npc) => npc.id), "phase11 NPCs");
  assertUnique(items.map((item) => item.id), "phase11 items");
  assertUnique(risks.map((risk) => risk.id), "phase11 risks");

  if (gate.reviewStatus !== "pending" || gate.reviewers.length !== 0 || gate.publicRuntimeEnabled) {
    throw new Error("phase11 candidate must remain private until a real external review is recorded");
  }

  const sourceIds = new Set(changanContent.sources.map((source) => source.id));
  const claimIds = new Set(changanContent.claims.map((claim) => claim.id));
  const mapFeatureIds = new Set(changanContent.mapFeatures.map((feature) => feature.id));
  const eventIds = new Set(events.map((event) => event.eventId));
  const npcIds = new Set(npcs.map((npc) => npc.id));

  for (const [locationId, featureId] of locationEvidence) {
    if (!mapFeatureIds.has(featureId)) throw new Error(`${locationId} references missing map feature ${featureId}`);
  }

  for (const npc of npcs) {
    assertReferences(npc.claimIds, claimIds, npc.id, "claim");
    assertReferences(npc.sourceIds, sourceIds, npc.id, "source");
  }
  for (const item of items) {
    assertReferences(item.claimIds, claimIds, item.id, "claim");
    assertReferences(item.sourceIds, sourceIds, item.id, "source");
  }
  for (const risk of risks) {
    assertReferences(risk.claimIds, claimIds, risk.id, "claim");
    assertReferences(risk.sourceIds, sourceIds, risk.id, "source");
  }

  for (const event of events) {
    assertReferences(event.claimIds, claimIds, event.eventId, "claim");
    assertReferences(event.evidenceRefs, sourceIds, event.eventId, "source");
    assertReferences(event.npcIds, npcIds, event.eventId, "NPC");
    if (!locationEvidence.has(event.locationId)) {
      throw new Error(`${event.eventId} references missing evidence location ${event.locationId}`);
    }
    const nextIds = new Set(event.choices.map((choice) => choice.nextEventId));
    if (nextIds.size !== 1) throw new Error(`${event.eventId} choices must converge on one editor-owned next event`);
    const [nextId] = nextIds;
    if (event.phase === "ending" && nextId !== null) throw new Error(`${event.eventId} ending must terminate`);
    if (event.phase !== "ending" && (nextId === null || !eventIds.has(nextId))) {
      throw new Error(`${event.eventId} has an invalid next event`);
    }
  }

  for (const chapter of chapters) {
    assertReferences(chapter.eventIds, eventIds, chapter.id, "event");
    assertReferences(chapter.npcIds, npcIds, chapter.id, "NPC");
    assertReferences(chapter.claimIds, claimIds, chapter.id, "claim");
    for (const locationId of chapter.locationIds) {
      if (!locationEvidence.has(locationId)) throw new Error(`${chapter.id} references missing location ${locationId}`);
    }
    const chapterEvents = chapter.eventIds.map((id) => events.find((event) => event.eventId === id)!);
    const sequences = chapterEvents.map((event) => event.sequence);
    if (sequences.join(",") !== "1,2,3,4,5,6,7,8,9") {
      throw new Error(`${chapter.id} must contain exactly nine ordered events`);
    }
    if (chapterEvents.some((event) => event.originId !== chapter.originId || event.chapterId !== chapter.id)) {
      throw new Error(`${chapter.id} contains an event from another chapter or origin`);
    }
    const phases = chapterEvents.map((event) => event.phase);
    if (phases[0] !== "opening" || phases.at(-1) !== "ending" || phases.filter((phase) => phase === "consequence").length !== 2) {
      throw new Error(`${chapter.id} does not meet the opening/core/consequence/ending contract`);
    }
  }

  const originCounts = new Map<string, number>();
  for (const npc of npcs) originCounts.set(npc.originId, (originCounts.get(npc.originId) ?? 0) + 1);
  for (const origin of originIdSchema.options) {
    if ((originCounts.get(origin) ?? 0) < 4) throw new Error(`${origin} has fewer than four functional NPCs`);
  }

  const statuses = [
    ...chapters.map((entry) => entry.publicationStatus),
    ...events.map((entry) => entry.publicationStatus),
    ...npcs.map((entry) => entry.publicationStatus),
    ...items.map((entry) => entry.publicationStatus),
    ...risks.map((entry) => entry.publicationStatus),
  ];
  if (statuses.some((status) => publicationStatusSchema.parse(status) !== "provisional")) {
    throw new Error("phase11 candidate contains a non-provisional entry");
  }

  return { gate, chapters, events, npcs, items, risks };
}

export const phase11Content = validatePhase11Content({
  gate: publicationGateJson,
  chapters: chaptersJson,
  events: eventsJson,
  npcs: npcsJson,
  items: itemsJson,
  risks: risksJson,
});
