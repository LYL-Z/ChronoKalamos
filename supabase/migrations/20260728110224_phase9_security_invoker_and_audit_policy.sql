-- Phase 9 security closure:
-- 1. Public RPCs remain callable through PostgREST, but are SECURITY INVOKER.
-- 2. Privileged implementations live in the unexposed private schema.
-- 3. The phone audit table keeps an explicit client deny policy.

create or replace function private.create_or_get_game_session_guarded(
  p_client_session_id uuid,
  p_origin_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.session_meets_mfa() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  return private.create_or_get_game_session_unchecked(
    p_client_session_id,
    p_origin_id
  );
end;
$$;

create or replace function private.reserve_game_turn_guarded(
  p_session_id uuid,
  p_client_turn_id uuid,
  p_expected_state_version integer,
  p_input jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.session_meets_mfa() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  return private.reserve_game_turn_unchecked(
    p_session_id,
    p_client_turn_id,
    p_expected_state_version,
    p_input
  );
end;
$$;

create or replace function private.delete_game_session_guarded(
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.session_meets_mfa() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  return private.delete_game_session_unchecked(p_session_id);
end;
$$;

revoke all on function private.create_or_get_game_session_guarded(uuid, text)
  from public, anon;
revoke all on function private.reserve_game_turn_guarded(uuid, uuid, integer, jsonb)
  from public, anon;
revoke all on function private.delete_game_session_guarded(uuid)
  from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.create_or_get_game_session_guarded(uuid, text)
  to authenticated;
grant execute on function private.reserve_game_turn_guarded(uuid, uuid, integer, jsonb)
  to authenticated;
grant execute on function private.delete_game_session_guarded(uuid)
  to authenticated;

create or replace function public.create_or_get_game_session(
  p_client_session_id uuid,
  p_origin_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.create_or_get_game_session_guarded(
    p_client_session_id,
    p_origin_id
  );
end;
$$;

create or replace function public.reserve_game_turn(
  p_session_id uuid,
  p_client_turn_id uuid,
  p_expected_state_version integer,
  p_input jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.reserve_game_turn_guarded(
    p_session_id,
    p_client_turn_id,
    p_expected_state_version,
    p_input
  );
end;
$$;

create or replace function public.delete_game_session(
  p_session_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.delete_game_session_guarded(p_session_id);
end;
$$;

revoke all on function public.create_or_get_game_session(uuid, text)
  from public, anon;
revoke all on function public.reserve_game_turn(uuid, uuid, integer, jsonb)
  from public, anon;
revoke all on function public.delete_game_session(uuid)
  from public, anon;

grant execute on function public.create_or_get_game_session(uuid, text)
  to authenticated;
grant execute on function public.reserve_game_turn(uuid, uuid, integer, jsonb)
  to authenticated;
grant execute on function public.delete_game_session(uuid)
  to authenticated;

alter function public.update_game_character_profile(uuid, jsonb)
  set schema private;
alter function private.update_game_character_profile(uuid, jsonb)
  rename to update_game_character_profile_unchecked;
revoke all on function private.update_game_character_profile_unchecked(uuid, jsonb)
  from public, anon, authenticated;

create function private.update_game_character_profile_guarded(
  p_session_id uuid,
  p_profile jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.session_meets_mfa() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  return private.update_game_character_profile_unchecked(
    p_session_id,
    p_profile
  );
end;
$$;

revoke all on function private.update_game_character_profile_guarded(uuid, jsonb)
  from public, anon;
grant execute on function private.update_game_character_profile_guarded(uuid, jsonb)
  to authenticated;

create function public.update_game_character_profile(
  p_session_id uuid,
  p_profile jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.update_game_character_profile_guarded(
    p_session_id,
    p_profile
  );
end;
$$;

revoke all on function public.update_game_character_profile(uuid, jsonb)
  from public, anon;
grant execute on function public.update_game_character_profile(uuid, jsonb)
  to authenticated;

drop policy if exists phone_auth_audit_deny_client_access
  on public.phone_auth_audit;
create policy phone_auth_audit_deny_client_access
  on public.phone_auth_audit
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on public.phone_auth_audit
  from public, anon, authenticated;
grant select, insert, update on public.phone_auth_audit
  to service_role;

comment on function public.create_or_get_game_session(uuid, text) is
  'SECURITY INVOKER API wrapper; privileged owner and MFA checks live in private schema.';
comment on function public.reserve_game_turn(uuid, uuid, integer, jsonb) is
  'SECURITY INVOKER API wrapper; privileged owner and MFA checks live in private schema.';
comment on function public.delete_game_session(uuid) is
  'SECURITY INVOKER API wrapper; privileged owner and MFA checks live in private schema.';
comment on function public.update_game_character_profile(uuid, jsonb) is
  'SECURITY INVOKER API wrapper; privileged owner and MFA checks live in private schema.';
