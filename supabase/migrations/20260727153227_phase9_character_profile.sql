-- ChronoKalamos phase 9: persist bounded character setup fields.
-- This function intentionally accepts a small allow-list only. The client
-- cannot replace the scenario, origin, world state, or social boundaries.

create or replace function public.update_game_character_profile(
  p_session_id uuid,
  p_profile jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_name text := nullif(trim(coalesce(p_profile ->> 'name', '')), '');
  v_gender text := coalesce(p_profile ->> 'gender', 'unspecified');
  v_temperament text := coalesce(p_profile ->> 'temperament', '谨慎');
begin
  if v_owner_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if jsonb_typeof(p_profile) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_character_profile';
  end if;

  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception using errcode = '22023', message = 'invalid_character_name';
  end if;

  if v_gender not in ('unspecified', 'female', 'male', 'nonbinary') then
    raise exception using errcode = '22023', message = 'invalid_character_gender';
  end if;

  if v_temperament not in ('谨慎', '好奇', '克制', '外向') then
    raise exception using errcode = '22023', message = 'invalid_character_temperament';
  end if;

  update public.game_sessions
  set character_profile = character_profile
    || jsonb_build_object(
      'name', v_name,
      'gender', v_gender,
      'temperament', v_temperament
    ),
    updated_at = now()
  where id = p_session_id
    and owner_id = v_owner_id;

  if not found then
    raise exception using errcode = '42501', message = 'session_not_owned';
  end if;

  return true;
end;
$$;

revoke all on function public.update_game_character_profile(uuid, jsonb)
  from public, anon;
grant execute on function public.update_game_character_profile(uuid, jsonb)
  to authenticated;

comment on function public.update_game_character_profile(uuid, jsonb) is
  'Owner-scoped bounded character setup update for the phase 9 onboarding slice.';
