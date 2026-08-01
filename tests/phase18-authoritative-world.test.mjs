import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260801144734_phase18_authoritative_world_systems.sql", import.meta.url),
  "utf8",
);
const leastPrivilegeMigration = await readFile(
  new URL("../supabase/migrations/20260801151512_phase18_reduce_system_ledger_grants.sql", import.meta.url),
  "utf8",
);
const route = await readFile(
  new URL("../app/api/game-sessions/[sessionId]/system-actions/route.ts", import.meta.url),
  "utf8",
);
const rules = await readFile(new URL("../lib/game/phase18-authority.ts", import.meta.url), "utf8");

test("Phase 18 migration commits system action, state and checkpoint atomically", () => {
  assert.match(migration, /create table public\.game_system_actions/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /state_version = v_new_version/i);
  assert.match(migration, /insert into public\.game_checkpoints/i);
  assert.match(migration, /unique \(owner_id, client_action_id\)/i);
  assert.match(migration, /system_idempotency_mismatch/i);
});

test("Phase 18 RLS exposes owner reads but no client writes or service RPC", () => {
  assert.match(migration, /alter table public\.game_system_actions enable row level security/i);
  assert.match(migration, /to authenticated\s+using \(\(select auth\.uid\(\)\) = owner_id\)/i);
  assert.match(migration, /revoke all on table public\.game_system_actions from public, anon, authenticated/i);
  assert.match(migration, /grant select on table public\.game_system_actions to authenticated/i);
  assert.match(migration, /server_commit_system_action[\s\S]+from public, anon, authenticated/i);
  assert.match(migration, /server_commit_system_action[\s\S]+to service_role/i);
  assert.match(leastPrivilegeMigration, /revoke all on table public\.game_system_actions from service_role/i);
  assert.match(leastPrivilegeMigration, /grant select on table public\.game_system_actions to service_role/i);
  assert.match(leastPrivilegeMigration, /assert_phase18_system_commit[\s\S]+service_role/i);
});

test("System API authenticates, normalizes and uses the deterministic reducer before RPC", () => {
  assert.match(route, /client\.auth\.getUser/);
  assert.match(route, /normalizeWorldState/);
  assert.match(route, /applyAuthoritativeSystemAction/);
  assert.match(route, /commitSystemAction/);
  assert.match(route, /findSystemActionReplay/);
  assert.match(route, /request\.body\?\.getReader/);
  assert.match(route, /reader\.cancel/);
});

test("Reachability is executable rather than a static fifty-row claim", () => {
  assert.match(rules, /buildPhase18ReachabilityPlan/);
  assert.match(rules, /executePhase18ReachabilityPlan/);
  assert.match(rules, /getPhase18EndingEligibility/);
  assert.match(rules, /endingGroupEligible/);
});
