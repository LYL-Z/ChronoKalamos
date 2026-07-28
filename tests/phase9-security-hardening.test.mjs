import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = new URL(
  "../supabase/migrations/20260728110224_phase9_security_invoker_and_audit_policy.sql",
  import.meta.url,
);

test("phase 9 keeps privileged RPCs private and public wrappers invoker-only", async () => {
  const sql = await readFile(migration, "utf8");

  for (const functionName of [
    "create_or_get_game_session",
    "reserve_game_turn",
    "delete_game_session",
    "update_game_character_profile",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `create (?:or replace )?function public\\.${functionName}[\\s\\S]*?security invoker`,
        "i",
      ),
    );
  }

  assert.match(sql, /private\.create_or_get_game_session_guarded[\s\S]*security definer/i);
  assert.match(sql, /private\.reserve_game_turn_guarded[\s\S]*security definer/i);
  assert.match(sql, /private\.delete_game_session_guarded[\s\S]*security definer/i);
  assert.match(sql, /private\.update_game_character_profile_guarded[\s\S]*security definer/i);
  assert.match(sql, /private\.session_meets_mfa\(\)/i);
  assert.match(sql, /revoke all on function public\.create_or_get_game_session[\s\S]*from public, anon/i);
});

test("phase 9 makes the phone audit client denial explicit", async () => {
  const sql = await readFile(migration, "utf8");

  assert.match(sql, /create policy phone_auth_audit_deny_client_access/i);
  assert.match(sql, /as restrictive[\s\S]*to anon, authenticated/i);
  assert.match(sql, /using \(false\)[\s\S]*with check \(false\)/i);
  assert.match(sql, /revoke all on public\.phone_auth_audit[\s\S]*from public, anon, authenticated/i);
});
