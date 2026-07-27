-- Phase 7 free authentication track: optional TOTP with database-enforced AAL2.
--
-- Users without a verified factor, including anonymous users, keep their
-- existing AAL1 access. Once a user verifies any MFA factor, every sensitive
-- user-owned table requires an AAL2 JWT. The public owner-scoped RPCs are
-- wrapped because their SECURITY DEFINER implementations otherwise bypass RLS.

create or replace function private.session_meets_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and array[coalesce((select auth.jwt() ->> 'aal'), 'aal1')] <@ (
      select case
        when count(id) > 0 then array['aal2']::text[]
        else array['aal1', 'aal2']::text[]
      end
      from auth.mfa_factors
      where user_id = (select auth.uid())
        and status = 'verified'
    );
$$;

revoke all on function private.session_meets_mfa() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.session_meets_mfa() to authenticated;

drop policy if exists "profiles_require_mfa_when_enrolled" on public.profiles;
create policy "profiles_require_mfa_when_enrolled" on public.profiles
  as restrictive
  for all
  to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_sessions_require_mfa_when_enrolled" on public.game_sessions;
create policy "game_sessions_require_mfa_when_enrolled" on public.game_sessions
  as restrictive
  for all
  to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_turn_requests_require_mfa_when_enrolled" on public.game_turn_requests;
create policy "game_turn_requests_require_mfa_when_enrolled" on public.game_turn_requests
  as restrictive
  for all
  to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_turns_require_mfa_when_enrolled" on public.game_turns;
create policy "game_turns_require_mfa_when_enrolled" on public.game_turns
  as restrictive
  for all
  to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_checkpoints_require_mfa_when_enrolled" on public.game_checkpoints;
create policy "game_checkpoints_require_mfa_when_enrolled" on public.game_checkpoints
  as restrictive
  for all
  to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "user_uploads_require_mfa_when_enrolled" on public.user_uploads;
create policy "user_uploads_require_mfa_when_enrolled" on public.user_uploads
  as restrictive
  for all
  to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "storage_user_uploads_require_mfa_when_enrolled" on storage.objects;
create policy "storage_user_uploads_require_mfa_when_enrolled" on storage.objects
  as restrictive
  for all
  to authenticated
  using (
    bucket_id <> 'user-uploads'
    or (select private.session_meets_mfa())
  )
  with check (
    bucket_id <> 'user-uploads'
    or (select private.session_meets_mfa())
  );

alter function public.create_or_get_game_session(uuid, text)
  set schema private;
alter function private.create_or_get_game_session(uuid, text)
  rename to create_or_get_game_session_unchecked;
revoke all on function private.create_or_get_game_session_unchecked(uuid, text)
  from public, anon, authenticated;

create function public.create_or_get_game_session(
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

alter function public.reserve_game_turn(uuid, uuid, integer, jsonb)
  set schema private;
alter function private.reserve_game_turn(uuid, uuid, integer, jsonb)
  rename to reserve_game_turn_unchecked;
revoke all on function private.reserve_game_turn_unchecked(uuid, uuid, integer, jsonb)
  from public, anon, authenticated;

create function public.reserve_game_turn(
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

alter function public.delete_game_session(uuid)
  set schema private;
alter function private.delete_game_session(uuid)
  rename to delete_game_session_unchecked;
revoke all on function private.delete_game_session_unchecked(uuid)
  from public, anon, authenticated;

create function public.delete_game_session(
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

comment on function private.session_meets_mfa() is
  'Returns true for AAL1 users without a verified MFA factor and AAL2 users after enrollment.';
comment on function public.create_or_get_game_session(uuid, text) is
  'Owner-scoped session creation with opt-in MFA enforcement.';
comment on function public.reserve_game_turn(uuid, uuid, integer, jsonb) is
  'Owner-scoped turn reservation with opt-in MFA enforcement.';
comment on function public.delete_game_session(uuid) is
  'Owner-scoped session deletion with opt-in MFA enforcement.';
