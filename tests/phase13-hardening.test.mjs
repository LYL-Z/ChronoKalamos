import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  migration: new URL("../supabase/migrations/20260729130650_phase13_ai_budget_and_audit.sql", import.meta.url),
  clientGuardMigration: new URL(
    "../supabase/migrations/20260729141942_phase13_revoke_rls_auto_enable_client_execute.sql",
    import.meta.url,
  ),
  workflow: new URL("../lib/game/workflow.ts", import.meta.url),
  repository: new URL("../lib/game/supabase-repository.ts", import.meta.url),
  audit: new URL("../lib/security/audit.ts", import.meta.url),
  readiness: new URL("../lib/health/readiness.ts", import.meta.url),
  readyRoute: new URL("../app/api/ready/route.ts", import.meta.url),
  ci: new URL("../.github/workflows/ci.yml", import.meta.url),
  env: new URL("../.env.example", import.meta.url),
  migrationLock: new URL("../supabase/migration-lock.json", import.meta.url),
};

test("phase 13 enforces privacy-safe, race-free AI daily admissions", async () => {
  const [migration, workflow, repository, audit, env] = await Promise.all([
    readFile(files.migration, "utf8"),
    readFile(files.workflow, "utf8"),
    readFile(files.repository, "utf8"),
    readFile(files.audit, "utf8"),
    readFile(files.env, "utf8"),
  ]);

  assert.match(migration, /create table if not exists public\.ai_call_audit/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /ai_call_audit_deny_client_access/i);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /unique \(owner_id, client_turn_id, attempt\)/i);
  assert.match(migration, /grant execute on function public\.reserve_ai_call[\s\S]*to service_role/i);
  const ddlWithoutComments = migration.replace(/--.*$/gm, "");
  assert.doesNotMatch(ddlWithoutComments, /\b(?:prompt|narrative|email|phone|ip_address)\b/i);
  assert.match(workflow, /reserveAiCall/);
  assert.match(workflow, /ai_daily_user_limit/);
  assert.match(repository, /complete_ai_call/);
  assert.match(audit, /SECURITY_AUDIT_SALT/);
  assert.match(audit, /actorHash/);
  const auditWithoutComments = audit.replace(/\/\*\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(auditWithoutComments, /request\.body|authorization|cookie/i);
  assert.match(env, /AI_DAILY_USER_LIMIT=40/);
  assert.match(env, /AI_DAILY_GLOBAL_LIMIT=500/);
  assert.match(env, /AI_TURNS_ENABLED=true/);
  assert.match(env, /SECURITY_AUDIT_SALT=/);
});

test("phase 13 adds deploy health, migration, secret, and live RLS gates", async () => {
  const [readiness, route, ci, migrationLock, clientGuardMigration] = await Promise.all([
    readFile(files.readiness, "utf8"),
    readFile(files.readyRoute, "utf8"),
    readFile(files.ci, "utf8"),
    readFile(files.migrationLock, "utf8"),
    readFile(files.clientGuardMigration, "utf8"),
  ]);
  const lock = JSON.parse(migrationLock);

  assert.match(readiness, /scenario_manifests/);
  assert.match(readiness, /contentDatabase/);
  assert.match(route, /status: readiness\.status === "ready" \? 200 : 503/);
  assert.match(ci, /Scan tracked files for credentials/);
  assert.match(ci, /Verify migration ledger/);
  assert.match(ci, /supabase-live/);
  assert.match(ci, /SUPABASE_TEST_SECRET_KEY/);
  assert.match(ci, /production-health/);
  assert.ok(lock.migrations.includes("20260729130650_phase13_ai_budget_and_audit.sql"));
  assert.ok(
    lock.migrations.includes("20260729141942_phase13_revoke_rls_auto_enable_client_execute.sql"),
  );
  assert.ok(lock.migrations.includes("20260729063339_phase11_voice_line_candidates.sql"));
  assert.ok(lock.migrations.includes("20260729063433_phase11_public_beta_runtime.sql"));
  assert.ok(!lock.migrations.includes("20260728141153_phase11_voice_line_candidates.sql"));
  assert.match(
    clientGuardMigration,
    /revoke all on function public\.rls_auto_enable\(\) from public/i,
  );
  assert.match(
    clientGuardMigration,
    /revoke execute on function public\.rls_auto_enable\(\) from anon, authenticated/i,
  );
});
