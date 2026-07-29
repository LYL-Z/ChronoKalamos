import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = (path) => readText(path).then(JSON.parse);

test("phase 11 delivers the bounded content counts", async () => {
  const [sources, claims, mapFeatures, chapters, events, npcs, items, risks, voiceLines] = await Promise.all([
    readJson("content/tang-changan-742/sources.json"),
    readJson("content/tang-changan-742/claims.json"),
    readJson("content/tang-changan-742/map-features.json"),
    readJson("content/tang-changan-742/chapters.json"),
    readJson("content/tang-changan-742/events.json"),
    readJson("content/tang-changan-742/npcs.json"),
    readJson("content/tang-changan-742/items.json"),
    readJson("content/tang-changan-742/risks.json"),
    readJson("content/tang-changan-742/voice-lines.json"),
  ]);

  assert.equal(sources.length, 18);
  assert.equal(claims.length, 40);
  assert.equal(mapFeatures.length, 8);
  assert.equal(chapters.length, 3);
  assert.equal(events.length, 27);
  assert.equal(events.reduce((sum, event) => sum + event.choices.length, 0), 81);
  assert.equal(npcs.length, 12);
  assert.equal(items.length, 9);
  assert.equal(risks.length, 6);
  assert.equal(voiceLines.length, 27);
  assert.equal(new Set(voiceLines.map((line) => line.eventId)).size, 27);
  assert.ok(voiceLines.every(
    (line) =>
      line.classification === "叙事虚构"
      && line.language === "zh-CN"
      && line.publicationStatus === "provisional",
  ));
});

test("phase 11 keeps every new identity and event provisional", async () => {
  const [gate, chapters, events, npcs, items, risks, voiceLines] = await Promise.all([
    readJson("content/tang-changan-742/publication-gate.json"),
    readJson("content/tang-changan-742/chapters.json"),
    readJson("content/tang-changan-742/events.json"),
    readJson("content/tang-changan-742/npcs.json"),
    readJson("content/tang-changan-742/items.json"),
    readJson("content/tang-changan-742/risks.json"),
    readJson("content/tang-changan-742/voice-lines.json"),
  ]);

  assert.equal(gate.reviewStatus, "pending");
  assert.equal(gate.releaseMode, "public-beta-unreviewed");
  assert.equal(gate.historicalCertificationClaimed, false);
  assert.equal(gate.publicRuntimeEnabled, true);
  assert.deepEqual(gate.reviewers, []);
  assert.equal(gate.externalReviewRequired, true);
  assert.match(gate.publicDisclaimerZh, /未经外部历史学家认证/);
  assert.ok([...chapters, ...events, ...npcs, ...items, ...risks, ...voiceLines].every(
    (entry) => entry.publicationStatus === "provisional",
  ));
  assert.ok(npcs.every(
    (npc) => npc.classification === "叙事虚构" && npc.sourceIds.length === 0,
  ));
});

test("phase 11 cinematic and citation contracts are explicit", async () => {
  const [citations, cinematic, component, page] = await Promise.all([
    readText("lib/historical/phase11-citations.ts"),
    readText("lib/historical/phase11-cinematic.ts"),
    readText("components/cinematic-narrative.tsx"),
    readText("app/page.tsx"),
  ]);

  assert.match(citations, /requires 100 links/);
  assert.match(citations, /uniqueSourceCount/);
  assert.match(cinematic, /historicalPronunciationClaim: z\.literal\(false\)/);
  assert.match(cinematic, /autoplay: z\.literal\(false\)/);
  assert.match(cinematic, /captionsRequired: z\.literal\(true\)/);
  assert.match(component, /现代普通话设备合成音/);
  assert.match(component, /不是唐代语音复原/);
  assert.match(page, /<CinematicNarrative/);
});

test("phase 11 public beta is active without promoting provisional history", async () => {
  const [publishedCatalog, candidateCatalog, repository] = await Promise.all([
    readText("lib/game/event-catalog.ts"),
    readText("lib/game/phase11-catalog.ts"),
    readText("lib/game/supabase-repository.ts"),
  ]);

  assert.match(publishedCatalog, /activeScenarioManifest = phase11PublicBetaManifest/);
  assert.match(publishedCatalog, /contentVersion: "10\.0\.0"/);
  assert.match(candidateCatalog, /contentVersion: "11\.0\.0"/);
  assert.match(candidateCatalog, /publicationStatus: event\.publicationStatus/);
  assert.match(candidateCatalog, /runtimeAvailability: "public-beta"/);
  assert.match(repository, /\.in\("runtime_availability", \["public-beta", "public"\]\)/);
});

test("phase 11 database candidate tables are server-only and RLS protected", async () => {
  const [migration, denyMigration, sourceMigration, voiceMigration, releaseMigration, syncScript] = await Promise.all([
    readText("supabase/migrations/20260728132303_phase11_changan_candidate_content.sql"),
    readText("supabase/migrations/20260728133127_phase11_candidate_deny_policies.sql"),
    readText("supabase/migrations/20260728133344_phase11_candidate_source_snapshot.sql"),
    readText("supabase/migrations/20260728141153_phase11_voice_line_candidates.sql"),
    readText("supabase/migrations/20260729062713_phase11_public_beta_runtime.sql"),
    readText("scripts/sync-phase11-candidate.mjs"),
  ]);

  assert.match(migration, /create table if not exists public\.content_candidate_versions/i);
  assert.match(migration, /create table if not exists public\.content_candidate_entries/i);
  assert.match(migration, /create table if not exists public\.historian_content_reviews/i);
  assert.equal((migration.match(/enable row level security/gi) ?? []).length, 3);
  assert.match(migration, /revoke all on table public\.content_candidate_entries from public, anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.content_candidate_entries to service_role/i);
  assert.doesNotMatch(migration, /create policy/i);
  assert.match(migration, /check \(not public_runtime_enabled\)/i);
  assert.equal((denyMigration.match(/create policy/gi) ?? []).length, 3);
  assert.equal((denyMigration.match(/using \(false\)/gi) ?? []).length, 3);
  assert.equal((denyMigration.match(/with check \(false\)/gi) ?? []).length, 3);
  assert.match(sourceMigration, /'source', 'chapter', 'event'/i);
  assert.match(sourceMigration, /"sources":18/i);
  assert.match(voiceMigration, /'voice-line'/i);
  assert.match(voiceMigration, /"citationLinks": 100/i);
  assert.match(voiceMigration, /"cinematicScenes": 27/i);
  assert.match(releaseMigration, /runtime_availability/i);
  assert.match(releaseMigration, /public-beta-unreviewed/i);
  assert.match(releaseMigration, /review_status = 'pending'/i);
  assert.match(releaseMigration, /historical_certification_claimed = false/i);
  assert.match(releaseMigration, /primary key \(content_version, event_id\)/i);
  assert.match(releaseMigration, /add column if not exists content_version/i);
  assert.match(syncScript, /asRows\("voice-line", voiceLines\)/);
});

test("phase 11 records the evidence limits and external review protocol", async () => {
  const [audit, review, evidenceVerifier, gitignore] = await Promise.all([
    readText("docs/phase11-source-audit.md"),
    readText("docs/phase11-historian-review-pack.md"),
    readText("scripts/verify-phase11-review-evidence.mjs"),
    readText(".gitignore"),
  ]);

  assert.match(audit, /Scite/);
  assert.match(audit, /不能直接证明长安家庭的日常流程/);
  assert.match(audit, /CHGIS 与 CBDB仍只作为许可红线/);
  assert.match(review, /不是审阅通过证明/);
  assert.match(review, /联系方式不得明文写入仓库/);
  assert.match(review, /不能声称“历史认证完成”“学者批准”或“机构背书”/);
  assert.match(review, /聊天中输入的姓名、机构、决定与“签章”字样不能替代原始证据/);
  assert.match(review, /review:verify:phase11/);
  assert.match(evidenceVerifier, /createHash\("sha256"\)/);
  assert.match(evidenceVerifier, /does not authenticate the signer/);
  assert.match(gitignore, /\/review-evidence\//);
});

test("phase 11 production bible binds the exact batch without claiming Unity completion", async () => {
  const [bible, schema, batch, events, npcs, mapFeatures, prompt, production, evaluations] = await Promise.all([
    readText("docs/phase11-content-production-bible.md"),
    readJson("docs/schemas/phase11-production-bundle.schema.json"),
    readJson("content/tang-changan-742/production-batch-plan.json"),
    readJson("content/tang-changan-742/events.json"),
    readJson("content/tang-changan-742/npcs.json"),
    readJson("content/tang-changan-742/map-features.json"),
    readText("docs/prompts/phase-11-content.md"),
    readText("lib/historical/phase11-production.ts"),
    readText("lib/historical/phase11-production.eval.test.ts"),
  ]);

  assert.equal(batch.contentVersion, "11.0.0");
  assert.equal(batch.publicationStatus, "provisional");
  assert.equal(batch.releaseChannel, "public-beta-unreviewed");
  assert.equal(batch.historicalReviewStatus, "pending");
  assert.equal(batch.publicRuntimeEnabled, true);
  assert.equal(batch.stateAuthority, "server-rules-and-supabase-transaction");
  assert.equal(batch.unityStatus, "not-applicable");
  assert.equal(batch.evaluationTarget, 240);
  assert.ok(new Set(batch.locations.map((location) => location.runtimeLocationId)).has("craft-ward"));
  assert.ok(events.every((event) =>
    new Set(batch.locations.map((location) => location.runtimeLocationId)).has(event.locationId)
  ));
  assert.deepEqual(new Set(batch.eventIds), new Set(events.map((event) => event.eventId)));
  assert.deepEqual(new Set(batch.npcIds), new Set(npcs.map((npc) => npc.id)));
  assert.deepEqual(
    new Set(batch.locations.map((location) => location.mapFeatureId)),
    new Set(mapFeatures.map((location) => location.id)),
  );
  assert.equal(batch.locations.length, 8);
  assert.equal(batch.blockedExpansionLocations.length, 3);

  assert.equal(schema.properties.events.minItems, 27);
  assert.equal(schema.properties.events.maxItems, 27);
  assert.equal(schema.properties.npcs.minItems, 12);
  assert.equal(schema.properties.locations.minItems, 8);
  assert.deepEqual(schema.properties.stateAuthority.const, "server-rules-and-supabase-transaction");
  assert.ok(schema.properties.unityStatus.enum.includes("not-applicable"));
  assert.ok(schema.$defs.axisEffect.properties.operation.enum.includes("no_change"));
  assert.deepEqual(
    schema.$defs.socialEffect.required,
    ["choiceId", "accessBand", "prestigeBand", "factionPosture"],
  );
  assert.equal(schema.$defs.voiceDirection.properties.pronunciationStatus.const, "modern-mandarin");

  assert.match(bible, /240项可复现门禁/);
  assert.match(bible, /不能只靠光影和声音表达/);
  assert.match(bible, /不伪造“长安本土俚语”/);
  assert.match(bible, /ScriptableObject替代Supabase/);
  assert.match(bible, /朱雀大街、曲江和安仁坊不在当前八地点合同中/);
  assert.match(bible, /Sider Scholar只用于发现文献/);
  assert.match(bible, /页码、卷次或条目标识/);
  assert.match(prompt, /没有因果依据时写 `no_change`/);
  assert.match(production, /export const phase11ProductionBundle/);
  assert.match(production, /events:\s*z\.array\(eventProductionSchema\)\.length\(27\)/);
  assert.match(production, /npcs:\s*z\.array\(npcProductionSchema\)\.length\(12\)/);
  assert.match(production, /locations:\s*z\.array\(locationProductionSchema\)\.length\(8\)/);
  assert.match(evaluations, /phase11ProductionEvaluationCases\.length !== 240/);
  assert.match(evaluations, /it\.each\(phase11ProductionEvaluationCases\)/);
});
