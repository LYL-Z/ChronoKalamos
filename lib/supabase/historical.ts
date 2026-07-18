import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  historicalClaimSchema,
  historicalOriginSchema,
  historicalSourceSchema,
  mapFeatureSchema,
  validateChanganContent,
  type HistoricalContent,
} from "@/lib/historical/content";

const sourceRowSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  creator: z.string(),
  date_label: z.string(),
  citation_mla: z.string(),
  locator: z.string(),
  source_url: z.string().url().nullable(),
  license_code: z.string(),
  usage_note: z.string(),
  notes: z.string(),
  published: z.literal(true),
});

const claimRowSchema = z.object({
  id: z.string(),
  classification: z.string(),
  subject_kind: z.string(),
  subject_id: z.string(),
  text_zh: z.string(),
  text_en: z.string(),
  source_ids: z.array(z.string()),
  source_note: z.string(),
  valid_from: z.number().int(),
  valid_to: z.number().int(),
  published: z.literal(true),
});

const originRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  english: z.string(),
  detail: z.string(),
  classification: z.string(),
  source_ids: z.array(z.string()),
  claim_ids: z.array(z.string()),
  published: z.literal(true),
});

const mapFeatureRowSchema = z.object({
  id: z.string(),
  name_zh: z.string(),
  name_en: z.string(),
  kind: z.string(),
  classification: z.string(),
  valid_from: z.number().int(),
  valid_to: z.number().int(),
  temporal_precision: z.string(),
  geometry: z.unknown(),
  schematic_position: z.object({ left: z.number(), top: z.number() }),
  uncertainty_code: z.string(),
  uncertainty_note_zh: z.string(),
  uncertainty_note_en: z.string(),
  source_ids: z.array(z.string()),
  license_code: z.string(),
  attribution: z.string(),
  published: z.literal(true),
});

const originSourceRowSchema = z.object({ origin_id: z.string(), source_id: z.string() });
const originClaimRowSchema = z.object({ origin_id: z.string(), claim_id: z.string() });

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(`历史内容读取失败：${error.message}`);
}

function requireRows<T>(rows: T[] | null, table: string): T[] {
  if (!rows || rows.length === 0) throw new Error(`历史内容表 ${table} 没有已发布记录。`);
  return rows;
}

export async function loadPublishedChanganContent(client: SupabaseClient): Promise<HistoricalContent> {
  const [sourcesResult, claimsResult, originsResult, mapFeaturesResult, originSourcesResult, originClaimsResult] = await Promise.all([
    client
      .from("historical_sources")
      .select("id,kind,title,creator,date_label,citation_mla,locator,source_url,license_code,usage_note,notes,published")
      .eq("scenario_id", "tang-changan-742")
      .eq("published", true)
      .order("id"),
    client
      .from("historical_claims")
      .select("id,classification,subject_kind,subject_id,text_zh,text_en,source_ids,source_note,valid_from,valid_to,published")
      .eq("scenario_id", "tang-changan-742")
      .eq("published", true)
      .order("id"),
    client
      .from("historical_origins")
      .select("id,code,title,english,detail,classification,source_ids,claim_ids,published")
      .eq("scenario_id", "tang-changan-742")
      .eq("published", true)
      .order("code"),
    client
      .from("map_features")
      .select("id,name_zh,name_en,kind,classification,valid_from,valid_to,temporal_precision,geometry,schematic_position,uncertainty_code,uncertainty_note_zh,uncertainty_note_en,source_ids,license_code,attribution,published")
      .eq("scenario_id", "tang-changan-742")
      .eq("published", true)
      .lte("valid_from", 742)
      .gte("valid_to", 742)
      .order("id"),
    client
      .from("historical_origin_sources")
      .select("origin_id,source_id")
      .order("origin_id")
      .order("source_id"),
    client
      .from("historical_origin_claims")
      .select("origin_id,claim_id")
      .order("origin_id")
      .order("claim_id"),
  ]);

  throwIfError(sourcesResult.error);
  throwIfError(claimsResult.error);
  throwIfError(originsResult.error);
  throwIfError(mapFeaturesResult.error);
  throwIfError(originSourcesResult.error);
  throwIfError(originClaimsResult.error);

  const sources = requireRows(sourcesResult.data, "historical_sources").map((row) => {
    const parsed = sourceRowSchema.parse(row);
    return historicalSourceSchema.parse({
      id: parsed.id,
      kind: parsed.kind,
      title: parsed.title,
      creator: parsed.creator,
      date: parsed.date_label,
      citationMla: parsed.citation_mla,
      locator: parsed.locator,
      url: parsed.source_url,
      licenseCode: parsed.license_code,
      usage: parsed.usage_note,
      notes: parsed.notes,
      published: parsed.published,
    });
  });

  const claims = requireRows(claimsResult.data, "historical_claims").map((row) => {
    const raw = claimRowSchema.parse(row);
    return historicalClaimSchema.parse({
      id: raw.id,
      classification: raw.classification,
      subjectKind: raw.subject_kind,
      subjectId: raw.subject_id,
      textZh: raw.text_zh,
      textEn: raw.text_en,
      sourceIds: raw.source_ids,
      sourceNote: raw.source_note,
      validFrom: raw.valid_from,
      validTo: raw.valid_to,
      published: raw.published,
    });
  });

  const origins = requireRows(originsResult.data, "historical_origins").map((row) => {
    const raw = originRowSchema.parse(row);
    return historicalOriginSchema.parse({
      id: raw.id,
      code: raw.code,
      title: raw.title,
      english: raw.english,
      detail: raw.detail,
      classification: raw.classification,
      sourceIds: raw.source_ids,
      claimIds: raw.claim_ids,
      published: raw.published,
    });
  });

  const mapFeatures = requireRows(mapFeaturesResult.data, "map_features").map((row) => {
    const raw = mapFeatureRowSchema.parse(row);
    return mapFeatureSchema.parse({
      id: raw.id,
      nameZh: raw.name_zh,
      nameEn: raw.name_en,
      kind: raw.kind,
      classification: raw.classification,
      validFrom: raw.valid_from,
      validTo: raw.valid_to,
      temporalPrecision: raw.temporal_precision,
      geometry: raw.geometry,
      schematicPosition: raw.schematic_position,
      uncertaintyCode: raw.uncertainty_code,
      uncertaintyNoteZh: raw.uncertainty_note_zh,
      uncertaintyNoteEn: raw.uncertainty_note_en,
      sourceIds: raw.source_ids,
      licenseCode: raw.license_code,
      attribution: raw.attribution,
      published: raw.published,
    });
  });

  const sourceRelations = requireRows(originSourcesResult.data, "historical_origin_sources").map((row) => originSourceRowSchema.parse(row));
  const claimRelations = requireRows(originClaimsResult.data, "historical_origin_claims").map((row) => originClaimRowSchema.parse(row));
  for (const origin of origins) {
    const sourceIds = sourceRelations.filter((relation) => relation.origin_id === origin.id).map((relation) => relation.source_id).sort();
    const claimIds = claimRelations.filter((relation) => relation.origin_id === origin.id).map((relation) => relation.claim_id).sort();
    if (sourceIds.join("|") !== [...origin.sourceIds].sort().join("|")) {
      throw new Error(`历史出身 ${origin.id} 的来源关系与主表不一致。`);
    }
    if (claimIds.join("|") !== [...origin.claimIds].sort().join("|")) {
      throw new Error(`历史出身 ${origin.id} 的主张关系与主表不一致。`);
    }
  }

  return validateChanganContent({ sources, claims, origins, mapFeatures });
}
