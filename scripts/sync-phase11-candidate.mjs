import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error("SUPABASE_TEST_URL and SUPABASE_TEST_SECRET_KEY are required");
}

const root = new URL("../", import.meta.url);
const readJson = (name) =>
  readFile(new URL(`content/tang-changan-742/${name}.json`, root), "utf8").then(JSON.parse);

const [sources, chapters, events, npcs, items, risks, voiceLines, claims, mapFeatures, gate] = await Promise.all([
  readJson("sources"),
  readJson("chapters"),
  readJson("events"),
  readJson("npcs"),
  readJson("items"),
  readJson("risks"),
  readJson("voice-lines"),
  readJson("claims"),
  readJson("map-features"),
  readJson("publication-gate"),
]);

if (
  gate.reviewStatus !== "pending"
  || gate.reviewers.length !== 0
  || gate.historicalCertificationClaimed
  || gate.releaseMode !== "public-beta-unreviewed"
) {
  throw new Error("refusing to sync Phase 11 without an explicit unreviewed public-beta gate");
}

const digest = (payload) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

const asRows = (entryType, entries, idField = "id") =>
  entries.map((payload) => ({
    scenario_id: gate.scenarioId,
    content_version: gate.candidateContentVersion,
    entry_type: entryType,
    entry_id: payload[idField],
    publication_status: "provisional",
    payload,
    payload_sha256: digest(payload),
  }));

const rows = [
  ...asRows("source", sources),
  ...asRows("chapter", chapters),
  ...asRows("event", events, "eventId"),
  ...asRows("npc", npcs),
  ...asRows("item", items),
  ...asRows("risk", risks),
  ...asRows("voice-line", voiceLines),
  ...asRows("claim", claims.filter((claim) => claim.publicationStatus === "provisional")),
  ...asRows("map-feature", mapFeatures.filter((feature) => feature.publicationStatus === "provisional")),
];

const client = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const expectedCounts = {
  sources: sources.length,
  chapters: chapters.length,
  events: events.length,
  choices: events.reduce((sum, event) => sum + event.choices.length, 0),
  npcs: npcs.length,
  items: items.length,
  risks: risks.length,
  voiceLines: voiceLines.length,
  citationLinks: 100,
  cinematicScenes: events.length,
  productionEvents: events.length,
  productionNpcs: npcs.length,
  productionLocations: mapFeatures.length,
  phase11Evaluations: 240,
  provisionalClaims: claims.filter((claim) => claim.publicationStatus === "provisional").length,
  provisionalMapFeatures: mapFeatures.filter((feature) => feature.publicationStatus === "provisional").length,
};

const { error: versionError } = await client
  .from("content_candidate_versions")
  .upsert({
    scenario_id: gate.scenarioId,
    content_version: gate.candidateContentVersion,
    runtime_fallback_version: gate.runtimeFallbackVersion,
    review_status: "pending",
    external_review_required: true,
    release_mode: gate.releaseMode,
    historical_certification_claimed: false,
    public_disclaimer_zh: gate.publicDisclaimerZh,
    public_disclaimer_en: gate.publicDisclaimerEn,
    public_runtime_enabled: true,
    expected_counts: expectedCounts,
    source_commit: process.env.PHASE11_SOURCE_COMMIT ?? null,
  });
if (versionError) throw versionError;

const { error: insertError } = await client
  .from("content_candidate_entries")
  .upsert(rows, {
    onConflict: "scenario_id,content_version,entry_type,entry_id",
  });
if (insertError) throw insertError;

const { count, error: countError } = await client
  .from("content_candidate_entries")
  .select("entry_id", { count: "exact", head: true })
  .eq("scenario_id", gate.scenarioId)
  .eq("content_version", gate.candidateContentVersion);
if (countError) throw countError;
if (count !== rows.length) throw new Error(`candidate row count drift: expected ${rows.length}, got ${count}`);

console.log(JSON.stringify({
  scenarioId: gate.scenarioId,
  contentVersion: gate.candidateContentVersion,
  reviewStatus: "pending",
  releaseMode: gate.releaseMode,
  historicalReviewStatus: gate.reviewStatus,
  publicRuntimeEnabled: true,
  entries: count,
  expectedCounts,
  status: "synced",
}, null, 2));
