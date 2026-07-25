import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/202607180001_phase3_identity_saves.sql", import.meta.url);
const hardeningMigrationUrl = new URL("../supabase/migrations/20260718123627_phase3_security_hardening.sql", import.meta.url);
const phase4MigrationUrl = new URL("../supabase/migrations/20260718142752_phase4_historical_content.sql", import.meta.url);
const phase4OriginsMigrationUrl = new URL("../supabase/migrations/20260718150936_phase4_historical_origins.sql", import.meta.url);
const phase5MigrationUrl = new URL("../supabase/migrations/20260725121824_phase5_turn_transactions.sql", import.meta.url);
const deepSeekMigrationUrl = new URL("../supabase/migrations/20260725213000_phase5_deepseek_provider.sql", import.meta.url);
const envExampleUrl = new URL("../.env.example", import.meta.url);
const browserClientUrl = new URL("../lib/supabase/browser.ts", import.meta.url);

test("every user-owned phase 3 table enables RLS and checks auth.uid", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const tables = ["profiles", "game_sessions", "game_turns", "game_checkpoints", "user_uploads"];

  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.ok((sql.match(/auth\.uid\(\)/g) ?? []).length >= 20, "owner policies must use auth.uid() throughout");
  assert.match(sql, /unique \(owner_id, client_session_id\)/i);
  assert.match(sql, /unique \(owner_id, client_turn_id\)/i);
  assert.match(sql, /foreign key \(session_id, owner_id\)/i);
});

test("private storage has bucket, size, MIME, folder, and owner constraints", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /'user-uploads'[\s\S]*false[\s\S]*5242880/i);
  assert.match(sql, /array\['image\/png', 'image\/jpeg', 'image\/webp'\]/i);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)::text\)/i);
  assert.match(sql, /owner_id = \(select auth\.uid\(\)::text\)/i);
  assert.match(sql, /user_uploads_path_owner_check check \(storage_path like \(owner_id::text \|\| '\/%'\)\)/i);
  assert.doesNotMatch(sql, /service_role/i);
});

test("browser configuration contains only publishable Supabase values", async () => {
  const [envExample, browserClient] = await Promise.all([
    readFile(envExampleUrl, "utf8"),
    readFile(browserClientUrl, "utf8"),
  ]);

  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_URL=/);
  assert.match(envExample, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/);
  assert.match(envExample, /SUPABASE_TEST_URL=/);
  assert.match(envExample, /SUPABASE_TEST_PUBLISHABLE_KEY=/);
  assert.match(envExample, /SUPABASE_TEST_UPGRADE_EMAIL=/);
  assert.match(envExample, /DEEPSEEK_API_KEY=/);
  assert.match(envExample, /DEEPSEEK_BASE_URL=https:\/\/api\.deepseek\.com/);
  assert.match(envExample, /DEEPSEEK_MODEL=/);
  assert.doesNotMatch(envExample, /SERVICE_ROLE_KEY=/);
  assert.doesNotMatch(browserClient, /service.role|service_role/i);
});

test("phase 3 hardening limits grants, protects the trigger helper, and indexes foreign keys", async () => {
  const sql = await readFile(hardeningMigrationUrl, "utf8");

  assert.match(sql, /create schema if not exists private/i);
  assert.match(sql, /function private\.handle_new_user\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /revoke all on function private\.handle_new_user\(\) from public, anon, authenticated/i);
  assert.match(sql, /drop function if exists public\.handle_new_user\(\)/i);
  assert.match(sql, /revoke all on table[\s\S]*from anon/i);
  assert.match(sql, /grant select, insert, update on table public\.profiles to authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table[\s\S]*public\.user_uploads[\s\S]*to authenticated/i);

  for (const index of [
    "game_checkpoints_owner_id_idx",
    "game_checkpoints_session_owner_idx",
    "game_turns_session_owner_idx",
    "user_uploads_owner_id_idx",
  ]) {
    assert.match(sql, new RegExp(`create index if not exists ${index}`, "i"));
  }
});

test("phase 4 evidence tables are read-only, published-only, and explicitly exposed", async () => {
  const sql = await readFile(phase4MigrationUrl, "utf8");
  for (const table of ["historical_sources", "historical_claims", "historical_claim_sources", "map_features", "map_feature_sources"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`grant select on table[\\s\\S]*public\\.${table}[\\s\\S]*to anon, authenticated`, "i"));
  }
  assert.match(sql, /using \(published = true\)/i);
  assert.match(sql, /historical_claims_source_check[\s\S]*classification = '叙事虚构'/i);
  assert.match(sql, /map_features_uncertainty_check/i);
  assert.match(sql, /map_features_license|license_code/i);
  assert.match(sql, /historical_claim_sources[\s\S]*references public\.historical_sources/i);
  assert.match(sql, /map_feature_sources[\s\S]*references public\.historical_sources/i);
  assert.match(sql, /historical_claim_sources_source_id_idx[\s\S]*historical_claim_sources \(source_id\)/i);
  assert.match(sql, /map_feature_sources_source_id_idx[\s\S]*map_feature_sources \(source_id\)/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete).*historical_(sources|claims)|grant (insert|update|delete).*map_features/i);
});

test("phase 4 origins are database-backed, published-only, and relation-safe", async () => {
  const sql = await readFile(phase4OriginsMigrationUrl, "utf8");
  for (const table of ["historical_origins", "historical_origin_sources", "historical_origin_claims"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`grant select on table[\\s\\S]*public\\.${table}[\\s\\S]*to anon, authenticated`, "i"));
  }
  assert.match(sql, /historical_origins_read_published[\s\S]*using \(published = true\)/i);
  assert.match(sql, /historical_origin_sources[\s\S]*references public\.historical_sources/i);
  assert.match(sql, /historical_origin_claims[\s\S]*references public\.historical_claims/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete).*historical_origins/i);
});

test("phase 5 turns are reserved, atomic, source-bound, and not directly writable", async () => {
  const sql = await readFile(phase5MigrationUrl, "utf8");
  assert.match(sql, /create table if not exists public\.game_turn_requests/i);
  assert.match(sql, /unique \(owner_id, client_turn_id\)/i);
  assert.match(sql, /input_hash/i);
  assert.match(sql, /create or replace function public\.reserve_game_turn/i);
  assert.match(sql, /create or replace function public\.commit_game_turn/i);
  assert.match(sql, /create or replace function public\.fail_game_turn/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /state_version_conflict/i);
  assert.match(sql, /unpublished_source_reference/i);
  assert.match(sql, /revoke insert, update, delete on public\.game_sessions from anon, authenticated/i);
  assert.match(sql, /revoke insert, update, delete on public\.game_turns from anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.commit_game_turn/i);
});

test("phase 5 session deletion is owner-scoped and does not restore table writes", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260725130108_phase5_session_cleanup.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create or replace function public\.delete_game_session/i);
  assert.match(sql, /owner_id = v_user_id/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on function public\.delete_game_session\(uuid\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.delete_game_session\(uuid\) to authenticated/i);
});

test("phase 5 commits are service-role only", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260725131032_phase5_server_only_commit.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /revoke execute on function public\.commit_game_turn[\s\S]*from authenticated/i);
  assert.match(sql, /revoke execute on function public\.fail_game_turn[\s\S]*from authenticated/i);
  assert.match(sql, /create or replace function public\.server_commit_game_turn/i);
  assert.match(sql, /set_config\('request\.jwt\.claim\.sub', p_owner_id::text, true\)/i);
  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.server_commit_game_turn[\s\S]*to service_role/i);
});

test("phase 5 turn-request foreign key has a covering index", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20260725131336_phase5_request_fk_index.sql", import.meta.url),
    "utf8",
  );

  assert.match(
    sql,
    /create index if not exists game_turn_requests_session_owner_idx[\s\S]*\(session_id, owner_id\)/i,
  );
});

test("phase 5 provider cutover normalizes legacy rows and enforces DeepSeek", async () => {
  const sql = await readFile(deepSeekMigrationUrl, "utf8");
  assert.match(sql, /update public\.game_turns[\s\S]*provider = 'deepseek-chat'/i);
  assert.match(sql, /alter column provider set default 'deepseek-chat'/i);
  assert.match(sql, /check \(provider = 'deepseek-chat'\)/i);
  assert.match(sql, /create trigger normalize_game_turn_provider/i);
  assert.match(sql, /new\.provider = 'openai-responses'/i);
});
