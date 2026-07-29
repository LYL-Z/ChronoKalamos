import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

const [batch, schema, events, npcs, mapFeatures, productionSource, evaluationSource] = await Promise.all([
  readJson("content/tang-changan-742/production-batch-plan.json"),
  readJson("docs/schemas/phase11-production-bundle.schema.json"),
  readJson("content/tang-changan-742/events.json"),
  readJson("content/tang-changan-742/npcs.json"),
  readJson("content/tang-changan-742/map-features.json"),
  readFile(new URL("lib/historical/phase11-production.ts", root), "utf8"),
  readFile(new URL("lib/historical/phase11-production.eval.test.ts", root), "utf8"),
]);

assert(batch.contentVersion === "11.0.0", "phase11_production_version_mismatch");
assert(batch.publicationStatus === "provisional", "phase11_production_must_be_provisional");
assert(batch.releaseChannel === "public-beta-unreviewed", "phase11_release_channel_mismatch");
assert(batch.historicalReviewStatus === "pending", "phase11_historical_review_must_remain_pending");
assert(batch.publicRuntimeEnabled === true, "phase11_public_beta_runtime_must_be_enabled");
assert(
  batch.stateAuthority === "server-rules-and-supabase-transaction",
  "phase11_production_state_authority_mismatch",
);
assert(batch.unityStatus === "not-applicable", "phase11_unity_status_must_remain_not_applicable");
assert(batch.evaluationTarget === 240, "phase11_evaluation_target_must_equal_240");

const eventIds = new Set(events.map((event) => event.eventId));
const npcIds = new Set(npcs.map((npc) => npc.id));
const mapFeatureIds = new Set(mapFeatures.map((feature) => feature.id));
const batchEventIds = new Set(batch.eventIds);
const batchNpcIds = new Set(batch.npcIds);
const batchMapFeatureIds = new Set(batch.locations.map((location) => location.mapFeatureId));
const batchRuntimeLocationIds = new Set(batch.locations.map((location) => location.runtimeLocationId));
const eventLocationIds = new Set(events.map((event) => event.locationId));

assert(eventIds.size === 27, "phase11_event_count_mismatch");
assert(npcIds.size === 12, "phase11_npc_count_mismatch");
assert(mapFeatureIds.size === 8, "phase11_location_count_mismatch");
assert(batchEventIds.size === 27, "phase11_batch_event_ids_not_unique");
assert(batchNpcIds.size === 12, "phase11_batch_npc_ids_not_unique");
assert(batchMapFeatureIds.size === 8, "phase11_batch_location_ids_not_unique");
assert(sameSet(eventIds, batchEventIds), "phase11_batch_event_coverage_mismatch");
assert(sameSet(npcIds, batchNpcIds), "phase11_batch_npc_coverage_mismatch");
assert(sameSet(mapFeatureIds, batchMapFeatureIds), "phase11_batch_location_coverage_mismatch");
assert(
  [...eventLocationIds].every((locationId) => batchRuntimeLocationIds.has(locationId)),
  "phase11_event_location_missing_from_production_batch",
);

assert(
  schema.properties.events.minItems === 27 && schema.properties.events.maxItems === 27,
  "phase11_schema_event_count_mismatch",
);
assert(
  schema.properties.npcs.minItems === 12 && schema.properties.npcs.maxItems === 12,
  "phase11_schema_npc_count_mismatch",
);
assert(
  schema.properties.locations.minItems === 8 && schema.properties.locations.maxItems === 8,
  "phase11_schema_location_count_mismatch",
);
assert(
  schema.$defs.axisEffect.properties.operation.enum.includes("no_change"),
  "phase11_social_effect_requires_no_change",
);
assert(
  ["choiceId", "accessBand", "prestigeBand", "factionPosture"].every(
    (field) => schema.$defs.socialEffect.required.includes(field),
  ),
  "phase11_each_choice_must_declare_three_social_axes",
);
assert(
  schema.$defs.voiceDirection.properties.pronunciationStatus.const === "modern-mandarin",
  "phase11_voice_direction_must_not_claim_historical_pronunciation",
);
assert(
  /phase11ProductionBundleSchema/.test(productionSource)
    && /events:\s*z\.array\(eventProductionSchema\)\.length\(27\)/.test(productionSource)
    && /npcs:\s*z\.array\(npcProductionSchema\)\.length\(12\)/.test(productionSource)
    && /locations:\s*z\.array\(locationProductionSchema\)\.length\(8\)/.test(productionSource),
  "phase11_runtime_production_bundle_schema_missing",
);

const evaluationMatrixTotal =
  27 * 3
  + 27
  + 12 * 3
  + 8 * 3
  + 27
  + 15
  + 15
  + 15;
assert(evaluationMatrixTotal === 240, "phase11_evaluation_matrix_arithmetic_mismatch");
assert(
  /phase11ProductionEvaluationCases\.length !== 240/.test(evaluationSource)
    && /it\.each\(phase11ProductionEvaluationCases\)/.test(evaluationSource),
  "phase11_executable_240_case_gate_missing",
);

const blockedNames = new Set(batch.blockedExpansionLocations.map((entry) => entry.nameZh));
assert(blockedNames.has("朱雀大街"), "phase11_zhuque_expansion_not_blocked");
assert(blockedNames.has("曲江"), "phase11_qujiang_expansion_not_blocked");
assert(blockedNames.has("安仁坊"), "phase11_anrenfang_expansion_not_blocked");

console.log(JSON.stringify({
  contentVersion: batch.contentVersion,
  events: eventIds.size,
  npcs: npcIds.size,
  locations: mapFeatureIds.size,
  evaluationTarget: batch.evaluationTarget,
  unityStatus: batch.unityStatus,
  publicRuntimeEnabled: batch.publicRuntimeEnabled,
  status: "passed",
}, null, 2));
