-- ChronoKalamos phase 5: keep authoritative state commits behind the server.
-- A signed-in browser may reserve its own turn, but it cannot call the commit
-- or failure functions directly. The server validates the user JWT, then uses
-- a Supabase secret key to call these service-role-only wrappers.

revoke execute on function public.commit_game_turn(
  uuid, uuid, integer, jsonb, jsonb, jsonb, text[], text
) from authenticated;
revoke execute on function public.fail_game_turn(
  uuid, uuid, text, text
) from authenticated;

create or replace function public.server_commit_game_turn(
  p_owner_id uuid,
  p_session_id uuid,
  p_client_turn_id uuid,
  p_expected_state_version integer,
  p_input jsonb,
  p_narrative jsonb,
  p_state_after jsonb,
  p_source_ids text[],
  p_provider_response_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null then
    raise exception using errcode = '22023', message = 'owner_required';
  end if;

  perform set_config('request.jwt.claim.sub', p_owner_id::text, true);

  return public.commit_game_turn(
    p_session_id,
    p_client_turn_id,
    p_expected_state_version,
    p_input,
    p_narrative,
    p_state_after,
    p_source_ids,
    p_provider_response_id
  );
end;
$$;

create or replace function public.server_fail_game_turn(
  p_owner_id uuid,
  p_session_id uuid,
  p_client_turn_id uuid,
  p_failure_code text,
  p_failure_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_owner_id is null then
    raise exception using errcode = '22023', message = 'owner_required';
  end if;

  perform set_config('request.jwt.claim.sub', p_owner_id::text, true);

  return public.fail_game_turn(
    p_session_id,
    p_client_turn_id,
    p_failure_code,
    p_failure_message
  );
end;
$$;

revoke all on function public.server_commit_game_turn(
  uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, text[], text
) from public, anon, authenticated;
revoke all on function public.server_fail_game_turn(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.server_commit_game_turn(
  uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, text[], text
) to service_role;
grant execute on function public.server_fail_game_turn(
  uuid, uuid, uuid, text, text
) to service_role;
