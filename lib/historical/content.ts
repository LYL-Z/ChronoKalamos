import { z } from "zod";
import sourcesJson from "@/content/tang-changan-742/sources.json";
import claimsJson from "@/content/tang-changan-742/claims.json";
import originsJson from "@/content/tang-changan-742/origins.json";
import mapFeaturesJson from "@/content/tang-changan-742/map-features.json";

export const classificationSchema = z.enum(["史料记载", "合理重建", "叙事虚构"]);
export const publicationStatusSchema = z.enum(["draft", "provisional", "reviewed", "published"]);

export const historicalSourceSchema = z.object({
  id: z.string().regex(/^S-\d{3}$/),
  kind: z.enum(["primary", "scholarship", "curatorial", "open-dataset", "license"]),
  title: z.string().min(1),
  creator: z.string().min(1),
  date: z.string().min(1),
  citationMla: z.string().min(1),
  locator: z.string().min(1),
  url: z.string().url().nullable(),
  licenseCode: z.string().min(1),
  usage: z.string().min(1),
  notes: z.string().min(1),
  published: z.boolean(),
});

export const historicalClaimSchema = z.object({
  id: z.string().regex(/^C-[A-Z0-9-]+$/),
  classification: classificationSchema,
  subjectKind: z.enum(["scenario", "institution", "place", "origin", "chapter", "npc", "item", "risk"]),
  subjectId: z.string().min(1),
  textZh: z.string().min(1),
  textEn: z.string().min(1),
  sourceIds: z.array(z.string().regex(/^S-\d{3}$/)),
  sourceNote: z.string().min(1),
  validFrom: z.number().int(),
  validTo: z.number().int(),
  publicationStatus: publicationStatusSchema.optional(),
  published: z.boolean(),
});

export const mapFeatureSchema = z.object({
  id: z.string().regex(/^M-\d{3}$/),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  kind: z.enum(["market", "gate", "administration", "palace", "ward-grid"]),
  classification: classificationSchema,
  validFrom: z.number().int(),
  validTo: z.number().int(),
  temporalPrecision: z.enum(["year", "decade", "century"]),
  geometry: z.object({
    type: z.enum(["Point", "Polygon"]),
    coordinateSystem: z.string().min(1),
    coordinates: z.array(z.unknown()).min(1),
  }),
  schematicPosition: z.object({ left: z.number().min(0).max(100), top: z.number().min(0).max(100) }),
  uncertaintyCode: z.enum(["low", "medium", "high"]),
  uncertaintyNoteZh: z.string().min(1),
  uncertaintyNoteEn: z.string().min(1),
  sourceIds: z.array(z.string().regex(/^S-\d{3}$/)).min(1),
  licenseCode: z.string().min(1),
  attribution: z.string().min(1),
  publicationStatus: publicationStatusSchema.optional(),
  published: z.boolean(),
});

export const historicalOriginSchema = z.object({
  id: z.enum(["merchant", "craft", "clerk"]),
  code: z.enum(["O-01", "O-02", "O-03"]),
  title: z.string().min(1),
  english: z.string().min(1),
  detail: z.string().min(1),
  classification: classificationSchema,
  sourceIds: z.array(z.string().regex(/^S-\d{3}$/)).min(1),
  claimIds: z.array(z.string().regex(/^C-[A-Z0-9-]+$/)).min(1),
  published: z.boolean(),
});

export type HistoricalSource = z.infer<typeof historicalSourceSchema>;
export type HistoricalClaim = z.infer<typeof historicalClaimSchema>;
export type MapFeature = z.infer<typeof mapFeatureSchema>;
export type HistoricalOrigin = z.infer<typeof historicalOriginSchema>;

export type HistoricalContent = {
  scenarioId: "tang-changan-742";
  year: 742;
  sources: HistoricalSource[];
  claims: HistoricalClaim[];
  origins: HistoricalOrigin[];
  mapFeatures: MapFeature[];
};

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate IDs`);
}

function assertReferencedSources(ids: string[], sourceIds: Set<string>, owner: string) {
  for (const id of ids) {
    if (!sourceIds.has(id)) throw new Error(`${owner} references missing source ${id}`);
  }
}

export function validateChanganContent(input: {
  sources: unknown;
  claims: unknown;
  origins: unknown;
  mapFeatures: unknown;
}): HistoricalContent {
  const sources = z.array(historicalSourceSchema).parse(input.sources);
  const claims = z.array(historicalClaimSchema).parse(input.claims);
  const origins = z.array(historicalOriginSchema).parse(input.origins);
  const mapFeatures = z.array(mapFeatureSchema).parse(input.mapFeatures);
  const sourceIds = new Set(sources.map((source) => source.id));
  const claimIds = new Set(claims.map((claim) => claim.id));

  assertUnique(sources.map((source) => source.id), "sources");
  assertUnique(claims.map((claim) => claim.id), "claims");
  assertUnique(origins.map((origin) => origin.id), "origins");
  assertUnique(mapFeatures.map((feature) => feature.id), "map features");

  for (const claim of claims) {
    if (claim.validFrom > claim.validTo) throw new Error(`${claim.id} has an inverted time range`);
    assertReferencedSources(claim.sourceIds, sourceIds, claim.id);
    if (claim.published && claim.classification !== "叙事虚构" && claim.sourceIds.length === 0) {
      throw new Error(`${claim.id} is published without a source`);
    }
    if (claim.published && claim.classification === "叙事虚构" && claim.sourceIds.length > 0) {
      throw new Error(`${claim.id} fiction must not masquerade as sourced fact`);
    }
  }

  for (const origin of origins) {
    assertReferencedSources(origin.sourceIds, sourceIds, origin.id);
    for (const claimId of origin.claimIds) {
      if (!claimIds.has(claimId)) throw new Error(`${origin.id} references missing claim ${claimId}`);
    }
  }

  for (const feature of mapFeatures) {
    if (feature.validFrom > 742 || feature.validTo < 742) throw new Error(`${feature.id} is not active in 742`);
    assertReferencedSources(feature.sourceIds, sourceIds, feature.id);
    if (feature.published && feature.sourceIds.length === 0) throw new Error(`${feature.id} is published without a source`);
    if (feature.licenseCode.trim().length === 0 || feature.attribution.trim().length === 0) {
      throw new Error(`${feature.id} is missing map license attribution`);
    }
  }

  return { scenarioId: "tang-changan-742", year: 742, sources, claims, origins, mapFeatures };
}

export const changanContent = validateChanganContent({
  sources: sourcesJson,
  claims: claimsJson,
  origins: originsJson,
  mapFeatures: mapFeaturesJson,
});

export function sourceLabel(classification: HistoricalClaim["classification"]): string {
  return classification;
}

export function sourceSummary(sourceIds: string[]): string {
  return sourceIds.length > 0 ? sourceIds.join(" · ") : "无直接来源";
}
