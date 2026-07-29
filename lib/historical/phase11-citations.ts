import { z } from "zod";
import { changanContent } from "@/lib/historical/content";
import { phase11Content, type Phase11EventBeat } from "@/lib/historical/phase11";

const sourceIdSchema = z.string().regex(/^S-\d{3}$/);
const claimIdSchema = z.string().regex(/^C-[A-Z0-9-]+$/);

export const phase11CitationLinkSchema = z.object({
  id: z.string().regex(/^cite-[a-z0-9-]+-s-\d{3}$/),
  eventId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  sourceId: sourceIdSchema,
  claimIds: z.array(claimIdSchema),
  scope: z.enum(["event-context", "claim-support", "scene-setting"]),
  noteZh: z.string().min(12).max(180),
  publicationStatus: z.literal("provisional"),
}).strict();

export type Phase11CitationLink = z.infer<typeof phase11CitationLinkSchema>;

const locationFeatureById = new Map([
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

const targetCountByOrigin = {
  merchant: 37,
  craft: 32,
  clerk: 31,
} as const;

function citationId(eventId: string, sourceId: string): string {
  return `cite-${eventId}-${sourceId.toLowerCase()}`;
}

function claimsForSource(event: Phase11EventBeat, sourceId: string): string[] {
  return event.claimIds.filter((claimId) => {
    const claim = changanContent.claims.find((candidate) => candidate.id === claimId);
    return claim?.sourceIds.includes(sourceId);
  });
}

function createLink(
  event: Phase11EventBeat,
  sourceId: string,
  scope: Phase11CitationLink["scope"],
): Phase11CitationLink {
  const claimIds = claimsForSource(event, sourceId);
  const noteZh = scope === "event-context"
    ? "编辑事件直接列出的背景来源；只限定可写范围，不证明虚构角色的具体经历。"
    : scope === "claim-support"
      ? "该来源通过事件所引用的历史声明建立联系；叙事细节仍不得升级为史料记载。"
      : "该来源只支持场景地点与空间语境；镜头、人物动作和台词均属叙事虚构。";

  return phase11CitationLinkSchema.parse({
    id: citationId(event.eventId, sourceId),
    eventId: event.eventId,
    sourceId,
    claimIds,
    scope,
    noteZh,
    publicationStatus: "provisional",
  });
}

export function buildPhase11CitationLinks(): Phase11CitationLink[] {
  const links: Phase11CitationLink[] = [];
  const seen = new Set<string>();

  function add(event: Phase11EventBeat, sourceId: string, scope: Phase11CitationLink["scope"]) {
    const key = `${event.eventId}:${sourceId}`;
    if (seen.has(key)) return;
    links.push(createLink(event, sourceId, scope));
    seen.add(key);
  }

  for (const event of phase11Content.events) {
    for (const sourceId of event.evidenceRefs) add(event, sourceId, "event-context");
    for (const claimId of event.claimIds) {
      const claim = changanContent.claims.find((candidate) => candidate.id === claimId);
      if (!claim) throw new Error(`citation builder cannot find claim ${claimId}`);
      for (const sourceId of claim.sourceIds) add(event, sourceId, "claim-support");
    }
  }

  for (const originId of Object.keys(targetCountByOrigin) as Array<keyof typeof targetCountByOrigin>) {
    const originEvents = phase11Content.events.filter((event) => event.originId === originId);
    const target = targetCountByOrigin[originId];
    let count = links.filter((link) => originEvents.some((event) => event.eventId === link.eventId)).length;

    for (const event of originEvents) {
      let eventCount = links.filter((link) => link.eventId === event.eventId).length;
      if (eventCount >= 3) continue;
      const featureId = locationFeatureById.get(event.locationId);
      const feature = changanContent.mapFeatures.find((candidate) => candidate.id === featureId);
      if (!feature) throw new Error(`citation builder cannot find map feature for ${event.locationId}`);
      for (const sourceId of feature.sourceIds) {
        if (eventCount >= 3) break;
        const before = links.length;
        add(event, sourceId, "scene-setting");
        if (links.length > before) {
          eventCount += 1;
          count += 1;
        }
      }
      if (eventCount < 3) {
        throw new Error(`${event.eventId} has fewer than three distinct citation links`);
      }
    }

    for (const event of originEvents) {
      if (count >= target) break;
      const featureId = locationFeatureById.get(event.locationId);
      const feature = changanContent.mapFeatures.find((candidate) => candidate.id === featureId);
      if (!feature) throw new Error(`citation builder cannot find map feature for ${event.locationId}`);
      for (const sourceId of feature.sourceIds) {
        if (count >= target) break;
        const before = links.length;
        add(event, sourceId, "scene-setting");
        if (links.length > before) count += 1;
      }
    }

    if (count !== target) {
      throw new Error(`${originId} citation target ${target} was not met; built ${count}`);
    }
  }

  const parsed = z.array(phase11CitationLinkSchema).parse(links);
  if (parsed.length !== 100) throw new Error(`phase11 citation contract requires 100 links; built ${parsed.length}`);
  if (new Set(parsed.map((link) => link.id)).size !== parsed.length) {
    throw new Error("phase11 citation links contain duplicate IDs");
  }

  const sourceIds = new Set(changanContent.sources.map((source) => source.id));
  for (const link of parsed) {
    if (!sourceIds.has(link.sourceId)) throw new Error(`${link.id} references a missing source`);
  }
  return parsed;
}

export const phase11CitationLinks = Object.freeze(buildPhase11CitationLinks());

export const phase11CitationMetrics = Object.freeze({
  linkCount: phase11CitationLinks.length,
  uniqueSourceCount: new Set(phase11CitationLinks.map((link) => link.sourceId)).size,
  eventCount: new Set(phase11CitationLinks.map((link) => link.eventId)).size,
  byScope: {
    eventContext: phase11CitationLinks.filter((link) => link.scope === "event-context").length,
    claimSupport: phase11CitationLinks.filter((link) => link.scope === "claim-support").length,
    sceneSetting: phase11CitationLinks.filter((link) => link.scope === "scene-setting").length,
  },
});
