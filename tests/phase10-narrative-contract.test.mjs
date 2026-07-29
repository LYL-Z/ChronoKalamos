import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  page: new URL("../app/page.tsx", import.meta.url),
  provider: new URL("../lib/game/ai-provider.ts", import.meta.url),
  repository: new URL("../lib/game/supabase-repository.ts", import.meta.url),
  rules: new URL("../lib/game/rules.ts", import.meta.url),
  schemas: new URL("../lib/game/schemas.ts", import.meta.url),
  catalog: new URL("../lib/game/event-catalog.ts", import.meta.url),
  evals: new URL("../lib/game/narrative.test.ts", import.meta.url),
  migration: new URL(
    "../supabase/migrations/20260728113545_phase10_event_consequence_system.sql",
    import.meta.url,
  ),
  manifestRoute: new URL(
    "../app/api/scenarios/[scenarioId]/manifest/route.ts",
    import.meta.url,
  ),
  recapRoute: new URL(
    "../app/api/game-sessions/[sessionId]/recap/route.ts",
    import.meta.url,
  ),
  chaptersRoute: new URL(
    "../app/api/game-sessions/[sessionId]/chapters/route.ts",
    import.meta.url,
  ),
  replayRoute: new URL(
    "../app/api/game-sessions/[sessionId]/replay-summary/route.ts",
    import.meta.url,
  ),
};

async function sources(...names) {
  return Promise.all(names.map((name) => readFile(files[name], "utf8")));
}

test("phase 10 keeps the model output contract expression-only", async () => {
  const [provider, schemas, rules] = await sources("provider", "schemas", "rules");

  assert.match(provider, /JSON 只能包含 title、text、choiceVariants、sourceIds/);
  assert.match(provider, /不能返回状态变化、关系变化、风险、地点、人物、物品、章节或结局字段/);
  assert.match(schemas, /export const narrativeExpressionSchema/);
  assert.match(schemas, /choiceVariants/);
  assert.match(rules, /validateNarrativeExpression/);
  assert.match(rules, /applyEventConsequence/);
  assert.doesNotMatch(
    provider.match(/const systemInstruction = \[[\s\S]*?\]\.join/)?.[0] ?? "",
    /stateDelta/,
  );
});

test("phase 10 publishes a versioned editor-owned event registry", async () => {
  const [catalog, repository] = await sources("catalog", "repository");
  const eventDefinitions = catalog.match(/^\s{4}eventId: "/gm) ?? [];
  const choiceDefinitions = catalog.match(/^\s{8}id: "choice-[1-5]"/gm) ?? [];

  assert.equal(eventDefinitions.length, 9);
  assert.equal(choiceDefinitions.length, 27);
  assert.match(catalog, /contentVersion: "10\.0\.0"/);
  assert.match(catalog, /publicationStatus: "published"/);
  assert.match(repository, /loadNarrativeCatalog/);
  assert.match(repository, /scenario_manifest_drift/);
  assert.match(repository, /event_registry_drift/);
});

test("phase 10 migration makes registry and replay summaries RLS-protected", async () => {
  const [migration] = await sources("migration");

  assert.match(migration, /create table if not exists public\.scenario_manifests/i);
  assert.match(migration, /create table if not exists public\.event_template_registry/i);
  assert.match(migration, /create table if not exists public\.game_replay_summaries/i);
  assert.match(migration, /enable row level security/gi);
  assert.match(migration, /private\.assert_phase10_event_commit/i);
  assert.match(migration, /create or replace function public\.server_commit_game_turn/i);
  assert.match(migration, /revoke all on function public\.server_commit_game_turn/i);
  assert.match(migration, /grant execute on function public\.server_commit_game_turn[\s\S]*to service_role/i);
});

test("versioned narrative runtime exposes manifest, chapters, recap and replay APIs", async () => {
  const [manifest, chapters, recap, replay] = await sources(
    "manifestRoute",
    "chaptersRoute",
    "recapRoute",
    "replayRoute",
  );

  assert.match(manifest, /activeScenarioManifest/);
  assert.match(chapters, /authenticateApiRequest/);
  assert.match(chapters, /loadOwnedApiSession/);
  assert.match(recap, /createReplaySummary/);
  assert.match(replay, /chapter_not_ended/);
  assert.match(replay, /game_replay_summaries/);
});

test("phase 10 interface discloses deterministic consequences and replay", async () => {
  const [page] = await sources("page");

  assert.match(page, /模型只负责受控叙事表达/);
  assert.match(page, /RISK CLOCKS/);
  assert.match(page, /RELATIONSHIP MEMORY/);
  assert.match(page, /CHAPTER CLOSED/);
  assert.match(page, /保留本次记录，重玩这一出身/);
  assert.match(page, /将映射到本事件声明的安全选择/);
});

test("phase 10 contains at least 90 fixed and adversarial evaluations", async () => {
  const [evals] = await sources("evals");

  assert.match(evals, /phase10EvaluationCount/);
  assert.match(evals, /toBeGreaterThanOrEqual\(90\)/);
  assert.match(evals, /validCases\.length/);
  assert.match(evals, /phase10EventTemplates\.length \* 4/);
  assert.match(evals, /prompt[- ]injection/i);
  assert.match(evals, /anachronism/i);
  assert.match(evals, /model-supplied state/i);
});
