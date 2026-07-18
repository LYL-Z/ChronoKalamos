import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/202607180001_phase3_identity_saves.sql", import.meta.url);
const hardeningMigrationUrl = new URL("../supabase/migrations/20260718122704_phase3_security_hardening.sql", import.meta.url);
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
