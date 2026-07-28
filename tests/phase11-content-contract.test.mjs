import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readJson = (path) => readText(path).then(JSON.parse);

test("phase 11 delivers the bounded content counts", async () => {
  const [sources, claims, mapFeatures, chapters, events, npcs, items, risks] = await Promise.all([
    readJson("content/tang-changan-742/sources.json"),
    readJson("content/tang-changan-742/claims.json"),
    readJson("content/tang-changan-742/map-features.json"),
    readJson("content/tang-changan-742/chapters.json"),
    readJson("content/tang-changan-742/events.json"),
    readJson("content/tang-changan-742/npcs.json"),
    readJson("content/tang-changan-742/items.json"),
    readJson("content/tang-changan-742/risks.json"),
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
});

test("phase 11 keeps every new identity and event provisional", async () => {
  const [gate, chapters, events, npcs, items, risks] = await Promise.all([
    readJson("content/tang-changan-742/publication-gate.json"),
    readJson("content/tang-changan-742/chapters.json"),
    readJson("content/tang-changan-742/events.json"),
    readJson("content/tang-changan-742/npcs.json"),
    readJson("content/tang-changan-742/items.json"),
    readJson("content/tang-changan-742/risks.json"),
  ]);

  assert.equal(gate.reviewStatus, "pending");
  assert.equal(gate.publicRuntimeEnabled, false);
  assert.deepEqual(gate.reviewers, []);
  assert.equal(gate.externalReviewRequired, true);
  assert.ok([...chapters, ...events, ...npcs, ...items, ...risks].every(
    (entry) => entry.publicationStatus === "provisional",
  ));
  assert.ok(npcs.every(
    (npc) => npc.classification === "叙事虚构" && npc.sourceIds.length === 0,
  ));
});

test("phase 11 candidate does not replace the published phase 10 runtime", async () => {
  const [publishedCatalog, candidateCatalog, repository] = await Promise.all([
    readText("lib/game/event-catalog.ts"),
    readText("lib/game/phase11-catalog.ts"),
    readText("lib/game/supabase-repository.ts"),
  ]);

  assert.doesNotMatch(publishedCatalog, /phase11Candidate/);
  assert.match(publishedCatalog, /contentVersion: "10\.0\.0"/);
  assert.match(candidateCatalog, /contentVersion: "11\.0\.0"/);
  assert.match(candidateCatalog, /publicationStatus: event\.publicationStatus/);
  assert.match(repository, /\.eq\("publication_status", "published"\)/);
});

test("phase 11 database candidate tables are server-only and RLS protected", async () => {
  const [migration, denyMigration, sourceMigration] = await Promise.all([
    readText("supabase/migrations/20260728132303_phase11_changan_candidate_content.sql"),
    readText("supabase/migrations/20260728133127_phase11_candidate_deny_policies.sql"),
    readText("supabase/migrations/20260728133344_phase11_candidate_source_snapshot.sql"),
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
});

test("phase 11 records the evidence limits and external review protocol", async () => {
  const [audit, review] = await Promise.all([
    readText("docs/phase11-source-audit.md"),
    readText("docs/phase11-historian-review-pack.md"),
  ]);

  assert.match(audit, /Scite/);
  assert.match(audit, /不能直接证明长安家庭的日常流程/);
  assert.match(audit, /CHGIS 与 CBDB仍只作为许可红线/);
  assert.match(review, /不是审阅通过证明/);
  assert.match(review, /联系方式不得明文写入仓库/);
  assert.match(review, /不能声称“历史内容发布完成”/);
});
