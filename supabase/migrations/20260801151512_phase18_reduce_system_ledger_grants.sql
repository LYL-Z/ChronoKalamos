-- Keep the ledger readable to the server adapter for idempotent replay, but
-- force every write through the validated transaction RPC. The SECURITY
-- DEFINER owner can still call private helpers without granting them to the
-- service role or browser roles.

revoke all on table public.game_system_actions from service_role;
grant select on table public.game_system_actions to service_role;

revoke all on function private.phase18_default_systems()
  from public, anon, authenticated, service_role;
revoke all on function private.assert_phase18_system_commit(
  public.game_sessions, text, text, jsonb, jsonb, jsonb, text[]
) from public, anon, authenticated, service_role;
