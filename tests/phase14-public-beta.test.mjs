import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("phase 14 is voluntary, version-bound, and refuses commercial completion without evidence", async () => {
  const [config, protocol, reportScript, page] = await Promise.all([
    read("lib/playtest/config.ts"),
    read("docs/playtest-protocol.md"),
    read("scripts/report-phase14-playtest.mjs"),
    read("app/playtest/page.tsx"),
  ]);
  assert.match(config, /appRelease: "38"/);
  assert.match(config, /contentVersion: "11\.0\.0"/);
  assert.match(config, /scenarioId: "tang-changan-742"/);
  assert.match(config, /scenarioVersion: "1\.0\.0"/);
  assert.match(protocol, /主动加入/);
  assert.match(protocol, /insufficient_evidence/);
  assert.match(reportScript, /smallCellsSuppressedBelow: 3/);
  assert.match(reportScript, /commercialGrade: experienceGate && trustGate/);
  assert.match(page, /当前评估：证据不足/);
  assert.match(page, /退出并删除测试数据/);
});

test("phase 14 telemetry schema has explicit RLS, grants, retention, and no raw-content columns", async () => {
  const [migration, api, server, cleanup] = await Promise.all([
    read("supabase/migrations/20260729144944_phase14_privacy_safe_playtest.sql"),
    read("app/api/playtest/events/route.ts"),
    read("lib/playtest/server.ts"),
    read("scripts/cleanup-phase14-playtest.mjs"),
  ]);
  assert.match(migration, /alter table public\.playtest_enrollments enable row level security/);
  assert.match(migration, /alter table public\.playtest_events enable row level security/);
  assert.match(migration, /revoke all on table public\.playtest_events from public, anon, authenticated/);
  assert.match(migration, /grant select, delete on table public\.playtest_events to authenticated/);
  assert.doesNotMatch(migration, /grant insert(?:[\s\S]{0,80})playtest_events to authenticated/i);
  assert.match(api, /MAX_EVENT_BYTES = 2 \* 1024/);
  assert.match(server, /ignoreDuplicates: true/);
  assert.match(cleanup, /process\.argv\.includes\("--apply"\)/);

  const eventTable = migration.match(/create table if not exists public\.playtest_events \(([\s\S]*?)\n\);/)?.[1] ?? "";
  for (const forbidden of ["email", "phone", "ip_address", "user_agent", "prompt", "narrative", "image", "payment", "cookie", "device_fingerprint"]) {
    assert.doesNotMatch(eventTable, new RegExp(`\\b${forbidden}\\b`, "i"));
  }
});

test("phase 14 client only sends bounded UI events; turn outcomes stay server-authoritative", async () => {
  const [schema, route, gameRoute] = await Promise.all([
    read("lib/playtest/schemas.ts"),
    read("app/api/playtest/events/route.ts"),
    read("app/api/game-sessions/[sessionId]/turns/route.ts"),
  ]);
  assert.doesNotMatch(schema.match(/clientPlaytestEventSchema[\s\S]*?\.strict\(\);/)?.[0] ?? "", /choice_submitted|turn_committed|turn_failed/);
  assert.match(route, /recordClientEvent/);
  assert.match(gameRoute, /recordTurnSubmission/);
  assert.match(gameRoute, /recordTurnOutcome/);
});
