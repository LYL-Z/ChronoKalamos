-- ChronoKalamos phase 5: authoritative, idempotent game-turn transactions.
-- AI output never writes tables directly. The application validates a candidate
-- turn, then calls these narrow RPCs with the signed-in user's JWT.

create table if not exists public.game_turn_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_turn_id uuid not null,
  expected_state_version integer not null,
  input_hash text not null,
  status text not null default 'processing',
  lease_expires_at timestamptz not null default (now() + interval '90 seconds'),
  response_snapshot jsonb,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_turn_requests_session_owner_fk
    foreign key (session_id, owner_id)
    references public.game_sessions (id, owner_id)
    on delete cascade,
  constraint game_turn_requests_version_check check (expected_state_version >= 0),
  constraint game_turn_requests_status_check check (status in ('processing', 'committed', 'failed')),
  constraint game_turn_requests_hash_check check (input_hash ~ '^[0-9a-f]{64}$'),
  constraint game_turn_requests_owner_client_key unique (owner_id, client_turn_id)
);

alter table public.game_turns
  add column if not exists expected_state_version integer not null default 0,
  add column if not exists input_hash text not null default repeat('0', 64),
  add column if not exists source_ids text[] not null default '{}'::text[],
  add column if not exists provider text not null default 'openai-responses',
  add column if not exists provider_response_id text;

alter table public.game_turns
  drop constraint if exists game_turns_expected_version_check;
alter table public.game_turns
  add constraint game_turns_expected_version_check check (expected_state_version >= 0);
alter table public.game_turns
  drop constraint if exists game_turns_input_hash_check;
alter table public.game_turns
  add constraint game_turns_input_hash_check check (input_hash ~ '^[0-9a-f]{64}$');
alter table public.game_turns
  drop constraint if exists game_turns_provider_check;
alter table public.game_turns
  add constraint game_turns_provider_check check (provider = 'openai-responses');

create index if not exists game_turn_requests_session_status_idx
  on public.game_turn_requests (session_id, status, updated_at desc);
create index if not exists game_turns_source_ids_idx
  on public.game_turns using gin (source_ids);

alter table public.game_turn_requests enable row level security;

drop policy if exists "game_turn_requests_select_own" on public.game_turn_requests;
create policy "game_turn_requests_select_own" on public.game_turn_requests
  for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Session state and committed turns are server-authoritative from phase 5 onward.
-- Authenticated clients may still read their rows, but cannot write around the
-- transaction functions below.
revoke insert, update, delete on public.game_sessions from anon, authenticated;
revoke insert, update, delete on public.game_turns from anon, authenticated;
revoke insert, update, delete on public.game_checkpoints from anon, authenticated;
revoke insert, update, delete on public.game_turn_requests from anon, authenticated;
grant select on public.game_turn_requests to authenticated;

drop policy if exists "game_sessions_insert_own" on public.game_sessions;
drop policy if exists "game_sessions_update_own" on public.game_sessions;
drop policy if exists "game_sessions_delete_own" on public.game_sessions;
drop policy if exists "game_turns_insert_own" on public.game_turns;
drop policy if exists "game_turns_update_own" on public.game_turns;
drop policy if exists "game_turns_delete_own" on public.game_turns;
drop policy if exists "game_checkpoints_insert_own" on public.game_checkpoints;
drop policy if exists "game_checkpoints_update_own" on public.game_checkpoints;
drop policy if exists "game_checkpoints_delete_own" on public.game_checkpoints;

create or replace function public.create_or_get_game_session(
  p_client_session_id uuid,
  p_origin_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.game_sessions%rowtype;
  v_title text;
  v_location_id text;
  v_location_label text;
  v_occupation text;
  v_cash integer;
  v_skills jsonb;
  v_world_state jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  case p_origin_id
    when 'merchant' then
      v_title := '西市粟特商户家庭后辈';
      v_location_id := 'western-market';
      v_location_label := '长安 · 西市';
      v_occupation := '商户家庭帮手';
      v_cash := 120;
      v_skills := '{"memory":6,"reasoning":5,"socialJudgment":7,"professionalPotential":6,"physical":5,"luck":5}'::jsonb;
    when 'craft' then
      v_title := '长安工匠家庭学徒';
      v_location_id := 'craft-ward';
      v_location_label := '长安 · 作坊所在坊区';
      v_occupation := '工匠学徒';
      v_cash := 30;
      v_skills := '{"memory":5,"reasoning":6,"socialJudgment":4,"professionalPotential":7,"physical":7,"luck":5}'::jsonb;
    when 'clerk' then
      v_title := '京兆基层吏员家庭成员';
      v_location_id := 'jingzhao-fu';
      v_location_label := '长安 · 京兆行政范围';
      v_occupation := '文书帮手';
      v_cash := 60;
      v_skills := '{"memory":7,"reasoning":7,"socialJudgment":6,"professionalPotential":6,"physical":4,"luck":5}'::jsonb;
    else
      raise exception using errcode = '22023', message = 'invalid_origin';
  end case;

  v_world_state := jsonb_build_object(
    'time', jsonb_build_object(
      'year', 742,
      'season', 'spring',
      'dayOfYear', 1,
      'minuteOfDay', 360,
      'totalMinutes', 0,
      'turn', 0
    ),
    'location', jsonb_build_object('id', v_location_id, 'label', v_location_label),
    'health', jsonb_build_object('condition', 'stable', 'vitality', 8),
    'socialIdentity', p_origin_id,
    'occupation', v_occupation,
    'money', jsonb_build_object('cash', v_cash, 'unit', '文（游戏记账单位）'),
    'items', '[]'::jsonb,
    'relationships', '[]'::jsonb,
    'reputation', jsonb_build_object('household', 0, 'market', 0, 'administration', 0),
    'skills', v_skills,
    'quests', '[]'::jsonb,
    'risks', '[]'::jsonb,
    'death', null
  );

  insert into public.game_sessions (
    owner_id,
    client_session_id,
    scenario_id,
    title,
    character_profile,
    world_state,
    status,
    state_version
  )
  values (
    v_user_id,
    p_client_session_id,
    'tang-changan-742',
    v_title,
    jsonb_build_object('origin', p_origin_id),
    v_world_state,
    'draft',
    0
  )
  on conflict (owner_id, client_session_id) do nothing;

  select *
  into v_session
  from public.game_sessions
  where owner_id = v_user_id
    and client_session_id = p_client_session_id;

  if v_session.id is null then
    raise exception using errcode = 'P0001', message = 'session_unavailable';
  end if;

  if v_session.character_profile ->> 'origin' <> p_origin_id then
    raise exception using errcode = '22023', message = 'client_session_origin_mismatch';
  end if;

  insert into public.game_checkpoints (
    session_id,
    owner_id,
    state_version,
    world_state,
    reason
  )
  values (
    v_session.id,
    v_user_id,
    v_session.state_version,
    v_session.world_state,
    'initial'
  )
  on conflict (session_id, state_version) do nothing;

  return jsonb_build_object(
    'id', v_session.id,
    'client_session_id', v_session.client_session_id,
    'scenario_id', v_session.scenario_id,
    'title', v_session.title,
    'status', v_session.status,
    'state_version', v_session.state_version,
    'world_state', v_session.world_state,
    'updated_at', v_session.updated_at
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
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.game_sessions%rowtype;
  v_request public.game_turn_requests%rowtype;
  v_input_hash text;
  v_inserted integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_expected_state_version < 0 then
    raise exception using errcode = '22023', message = 'invalid_state_version';
  end if;

  v_input_hash := encode(
    extensions.digest(convert_to(coalesce(p_input, '{}'::jsonb)::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select *
  into v_session
  from public.game_sessions
  where id = p_session_id
    and owner_id = v_user_id
  for update;

  if v_session.id is null then
    raise exception using errcode = '42501', message = 'session_not_owned';
  end if;

  insert into public.game_turn_requests (
    session_id,
    owner_id,
    client_turn_id,
    expected_state_version,
    input_hash
  )
  values (
    p_session_id,
    v_user_id,
    p_client_turn_id,
    p_expected_state_version,
    v_input_hash
  )
  on conflict (owner_id, client_turn_id) do nothing;
  get diagnostics v_inserted = row_count;

  select *
  into v_request
  from public.game_turn_requests
  where owner_id = v_user_id
    and client_turn_id = p_client_turn_id
  for update;

  if v_request.session_id <> p_session_id
    or v_request.expected_state_version <> p_expected_state_version
    or v_request.input_hash <> v_input_hash then
    raise exception using errcode = '22023', message = 'client_turn_id_reuse';
  end if;

  if v_inserted = 0 and v_request.status = 'committed' then
    return jsonb_build_object(
      'status', 'committed',
      'inputHash', v_request.input_hash,
      'snapshot', v_request.response_snapshot
    );
  end if;

  if v_inserted = 0 and v_request.status = 'failed' then
    return jsonb_build_object(
      'status', 'failed',
      'inputHash', v_request.input_hash,
      'failureCode', v_request.failure_code,
      'failureMessage', v_request.failure_message
    );
  end if;

  if v_inserted = 0 and v_request.lease_expires_at > now() then
    return jsonb_build_object(
      'status', 'in_progress',
      'inputHash', v_request.input_hash,
      'leaseExpiresAt', v_request.lease_expires_at
    );
  end if;

  if v_session.state_version <> p_expected_state_version then
    raise exception using errcode = '40001', message = 'state_version_conflict';
  end if;

  update public.game_turn_requests
  set lease_expires_at = now() + interval '90 seconds',
      updated_at = now()
  where id = v_request.id;

  return jsonb_build_object(
    'status', 'reserved',
    'inputHash', v_request.input_hash,
    'leaseExpiresAt', now() + interval '90 seconds'
  );
end;
$$;

create or replace function public.commit_game_turn(
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
declare
  v_user_id uuid := auth.uid();
  v_session public.game_sessions%rowtype;
  v_request public.game_turn_requests%rowtype;
  v_input_hash text;
  v_turn_id uuid;
  v_new_version integer;
  v_snapshot jsonb;
  v_old_total_minutes integer;
  v_new_total_minutes integer;
  v_old_cash integer;
  v_new_cash integer;
  v_old_vitality integer;
  v_new_vitality integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  v_input_hash := encode(
    extensions.digest(convert_to(coalesce(p_input, '{}'::jsonb)::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select *
  into v_request
  from public.game_turn_requests
  where owner_id = v_user_id
    and client_turn_id = p_client_turn_id
  for update;

  if v_request.id is null
    or v_request.session_id <> p_session_id
    or v_request.expected_state_version <> p_expected_state_version
    or v_request.input_hash <> v_input_hash then
    raise exception using errcode = '42501', message = 'turn_not_reserved';
  end if;

  if v_request.status = 'committed' then
    return v_request.response_snapshot || jsonb_build_object('duplicate', true);
  end if;
  if v_request.status <> 'processing' then
    raise exception using errcode = 'P0001', message = 'turn_not_processing';
  end if;

  select *
  into v_session
  from public.game_sessions
  where id = p_session_id
    and owner_id = v_user_id
  for update;

  if v_session.id is null then
    raise exception using errcode = '42501', message = 'session_not_owned';
  end if;
  if v_session.state_version <> p_expected_state_version then
    raise exception using errcode = '40001', message = 'state_version_conflict';
  end if;
  if jsonb_typeof(p_state_after) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_world_state';
  end if;
  if (p_state_after - array[
    'time', 'location', 'health', 'socialIdentity', 'occupation', 'money',
    'items', 'relationships', 'reputation', 'skills', 'quests', 'risks', 'death'
  ]::text[]) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'world_state_extra_keys';
  end if;
  if (p_state_after #>> '{time,year}')::integer <> 742 then
    raise exception using errcode = '22023', message = 'scenario_year_violation';
  end if;
  if (p_state_after #>> '{time,turn}')::integer <> p_expected_state_version + 1 then
    raise exception using errcode = '22023', message = 'turn_number_violation';
  end if;

  v_old_total_minutes := (v_session.world_state #>> '{time,totalMinutes}')::integer;
  v_new_total_minutes := (p_state_after #>> '{time,totalMinutes}')::integer;
  if v_new_total_minutes - v_old_total_minutes not between 5 and 180 then
    raise exception using errcode = '22023', message = 'time_advance_violation';
  end if;
  if v_new_total_minutes >= 525600 then
    raise exception using errcode = '22023', message = 'scenario_time_boundary';
  end if;

  v_old_cash := (v_session.world_state #>> '{money,cash}')::integer;
  v_new_cash := (p_state_after #>> '{money,cash}')::integer;
  if v_new_cash < 0 or abs(v_new_cash - v_old_cash) > 100 then
    raise exception using errcode = '22023', message = 'money_delta_violation';
  end if;

  v_old_vitality := (v_session.world_state #>> '{health,vitality}')::integer;
  v_new_vitality := (p_state_after #>> '{health,vitality}')::integer;
  if v_new_vitality not between 0 and 10
    or v_new_vitality - v_old_vitality not between -2 and 1 then
    raise exception using errcode = '22023', message = 'health_delta_violation';
  end if;

  if cardinality(coalesce(p_source_ids, '{}'::text[])) = 0 then
    raise exception using errcode = '22023', message = 'sources_required';
  end if;
  if exists (
    select 1
    from unnest(p_source_ids) as source_id
    where not exists (
      select 1
      from public.historical_sources source
      where source.id = source_id
        and source.published = true
        and source.scenario_id = v_session.scenario_id
    )
  ) then
    raise exception using errcode = '22023', message = 'unpublished_source_reference';
  end if;

  v_new_version := p_expected_state_version + 1;
  insert into public.game_turns (
    session_id,
    owner_id,
    client_turn_id,
    turn_number,
    input,
    narrative,
    state_before,
    state_after,
    committed_state_version,
    expected_state_version,
    input_hash,
    source_ids,
    provider,
    provider_response_id
  )
  values (
    p_session_id,
    v_user_id,
    p_client_turn_id,
    v_new_version,
    p_input,
    p_narrative,
    v_session.world_state,
    p_state_after,
    v_new_version,
    p_expected_state_version,
    v_input_hash,
    p_source_ids,
    'openai-responses',
    p_provider_response_id
  )
  returning id into v_turn_id;

  update public.game_sessions
  set world_state = p_state_after,
      state_version = v_new_version,
      status = case when p_state_after -> 'death' is null then 'active' else 'ended' end,
      updated_at = now()
  where id = p_session_id
    and owner_id = v_user_id;

  insert into public.game_checkpoints (
    session_id,
    owner_id,
    state_version,
    world_state,
    reason
  )
  values (
    p_session_id,
    v_user_id,
    v_new_version,
    p_state_after,
    case when p_state_after -> 'death' is null then 'turn' else 'ending' end
  );

  v_snapshot := jsonb_build_object(
    'turnId', v_turn_id,
    'stateVersion', v_new_version,
    'worldState', p_state_after,
    'narrative', p_narrative,
    'duplicate', false
  );

  update public.game_turn_requests
  set status = 'committed',
      response_snapshot = v_snapshot,
      failure_code = null,
      failure_message = null,
      updated_at = now()
  where id = v_request.id;

  return v_snapshot;
end;
$$;

create or replace function public.fail_game_turn(
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
declare
  v_user_id uuid := auth.uid();
  v_request public.game_turn_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select *
  into v_request
  from public.game_turn_requests
  where owner_id = v_user_id
    and client_turn_id = p_client_turn_id
    and session_id = p_session_id
  for update;

  if v_request.id is null then
    raise exception using errcode = '42501', message = 'turn_not_reserved';
  end if;
  if v_request.status = 'committed' then
    return jsonb_build_object('status', 'committed', 'snapshot', v_request.response_snapshot);
  end if;

  update public.game_turn_requests
  set status = 'failed',
      failure_code = left(coalesce(p_failure_code, 'turn_failed'), 80),
      failure_message = left(coalesce(p_failure_message, '本回合未提交。'), 500),
      updated_at = now()
  where id = v_request.id;

  return jsonb_build_object(
    'status', 'failed',
    'failureCode', left(coalesce(p_failure_code, 'turn_failed'), 80),
    'failureMessage', left(coalesce(p_failure_message, '本回合未提交。'), 500)
  );
end;
$$;

revoke all on function public.create_or_get_game_session(uuid, text) from public, anon;
revoke all on function public.reserve_game_turn(uuid, uuid, integer, jsonb) from public, anon;
revoke all on function public.commit_game_turn(uuid, uuid, integer, jsonb, jsonb, jsonb, text[], text) from public, anon;
revoke all on function public.fail_game_turn(uuid, uuid, text, text) from public, anon;

grant execute on function public.create_or_get_game_session(uuid, text) to authenticated;
grant execute on function public.reserve_game_turn(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.commit_game_turn(uuid, uuid, integer, jsonb, jsonb, jsonb, text[], text) to authenticated;
grant execute on function public.fail_game_turn(uuid, uuid, text, text) to authenticated;
