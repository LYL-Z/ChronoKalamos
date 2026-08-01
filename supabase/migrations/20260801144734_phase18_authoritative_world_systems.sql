-- Phase 18: authoritative household -> office -> commerce -> elite -> realm loop.
--
-- The application rules engine computes candidate state. This migration makes
-- the database the final authority: one row lock, one state-version increment,
-- one immutable action ledger row and one checkpoint are committed together.

create or replace function private.phase18_default_systems()
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'rulesetVersion', '18.0.0',
    'household', jsonb_build_object(
      'actorAge', null,
      'standing', 0,
      'marriageStatus', 'unmarried',
      'marriageContractId', null,
      'members', '[]'::jsonb,
      'children', 0
    ),
    'office', jsonb_build_object(
      'qualification', 0,
      'appointment', null,
      'dutyCompleted', 0,
      'merit', 0
    ),
    'commerce', jsonb_build_object(
      'completedTrades', 0,
      'turnover', 0,
      'workshopOutput', 0
    ),
    'casework', jsonb_build_object('cases', '[]'::jsonb, 'resolvedCount', 0),
    'eliteNetwork', jsonb_build_object('standing', 0, 'introductions', 0, 'councilAccess', false),
    'governance', jsonb_build_object(
      'access', false,
      'treasury', 50,
      'publicTrust', 50,
      'order', 50,
      'relief', 0,
      'reviewedCircuits', '[]'::jsonb,
      'policyCount', 0
    ),
    'legacy', jsonb_build_object('prudent', 0, 'opportunity', 0, 'cost', 0, 'disorder', 0, 'aftermath', 0),
    'actionCounts', '{}'::jsonb,
    'activeEndingId', null
  );
$$;

revoke all on function private.phase18_default_systems() from public, anon, authenticated;
grant execute on function private.phase18_default_systems() to service_role;

update public.game_sessions
set world_state = jsonb_set(world_state, '{systems}', private.phase18_default_systems(), true),
    updated_at = now()
where jsonb_typeof(world_state) = 'object'
  and not (world_state ? 'systems');

update public.game_checkpoints
set world_state = jsonb_set(world_state, '{systems}', private.phase18_default_systems(), true)
where jsonb_typeof(world_state) = 'object'
  and not (world_state ? 'systems');

update public.game_turns
set state_before = case
      when jsonb_typeof(state_before) = 'object' and not (state_before ? 'systems')
        then jsonb_set(state_before, '{systems}', private.phase18_default_systems(), true)
      else state_before
    end,
    state_after = case
      when jsonb_typeof(state_after) = 'object' and not (state_after ? 'systems')
        then jsonb_set(state_after, '{systems}', private.phase18_default_systems(), true)
      else state_after
    end;

create table public.game_system_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_action_id uuid not null,
  expected_state_version integer not null check (expected_state_version >= 0),
  committed_state_version integer not null check (committed_state_version = expected_state_version + 1),
  action_id text not null check (action_id in (
    'confirm-adult-age', 'household-care', 'marriage-contract', 'register-child-care',
    'study-records', 'case-open', 'case-investigate', 'case-resolve',
    'office-appoint', 'office-duty', 'trade-buy', 'trade-sell', 'workshop-production',
    'elite-introduction', 'elite-council', 'governance-accession',
    'governance-revenue', 'governance-relief', 'prepare-departure', 'conclude-chapter'
  )),
  approach text not null check (approach in ('prudent', 'opportunity', 'cost', 'disorder', 'aftermath')),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  event jsonb not null check (jsonb_typeof(event) = 'object'),
  state_before jsonb not null check (jsonb_typeof(state_before) = 'object'),
  state_after jsonb not null check (jsonb_typeof(state_after) = 'object'),
  source_ids text[] not null check (cardinality(source_ids) between 1 and 8),
  response_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint game_system_actions_session_owner_fk
    foreign key (session_id, owner_id)
    references public.game_sessions(id, owner_id)
    on delete cascade,
  constraint game_system_actions_owner_client_unique unique (owner_id, client_action_id)
);

create index game_system_actions_session_version_idx
  on public.game_system_actions(session_id, owner_id, committed_state_version desc);
create index game_system_actions_owner_created_idx
  on public.game_system_actions(owner_id, created_at desc);

alter table public.game_system_actions enable row level security;

create policy game_system_actions_select_own
  on public.game_system_actions
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy game_system_actions_require_mfa_when_enrolled
  on public.game_system_actions
  as restrictive
  for select
  to authenticated
  using ((select private.session_meets_mfa()));

revoke all on table public.game_system_actions from public, anon, authenticated;
grant select on table public.game_system_actions to authenticated;
grant select, insert, update, delete on table public.game_system_actions to service_role;

create or replace function private.assert_phase18_system_commit(
  p_session public.game_sessions,
  p_action_id text,
  p_approach text,
  p_parameters jsonb,
  p_event jsonb,
  p_state_after jsonb,
  p_source_ids text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.game_sessions%rowtype := p_session;
  v_old_count integer;
  v_new_count integer;
  v_old_legacy integer;
  v_new_legacy integer;
  v_ending_id text := p_parameters ->> 'endingId';
begin
  if p_action_id not in (
    'confirm-adult-age', 'household-care', 'marriage-contract', 'register-child-care',
    'study-records', 'case-open', 'case-investigate', 'case-resolve',
    'office-appoint', 'office-duty', 'trade-buy', 'trade-sell', 'workshop-production',
    'elite-introduction', 'elite-council', 'governance-accession',
    'governance-revenue', 'governance-relief', 'prepare-departure', 'conclude-chapter'
  ) then
    raise exception using errcode = '22023', message = 'system_action_unknown';
  end if;
  if p_approach not in ('prudent', 'opportunity', 'cost', 'disorder', 'aftermath') then
    raise exception using errcode = '22023', message = 'system_approach_invalid';
  end if;
  if jsonb_typeof(p_parameters) <> 'object'
    or jsonb_typeof(p_event) <> 'object'
    or jsonb_typeof(p_state_after) <> 'object'
    or jsonb_typeof(p_state_after -> 'systems') <> 'object' then
    raise exception using errcode = '22023', message = 'system_payload_invalid';
  end if;
  if (p_state_after - array[
    'time', 'location', 'health', 'energy', 'morale', 'socialIdentity', 'occupation',
    'money', 'items', 'relationships', 'reputation', 'skills', 'quests', 'risks',
    'death', 'story', 'systems'
  ]::text[]) <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'world_state_extra_keys';
  end if;
  if p_state_after #>> '{systems,rulesetVersion}' <> '18.0.0'
    or (p_state_after #>> '{time,year}')::integer <> 742
    or (p_state_after #>> '{time,turn}')::integer <> v_old.state_version + 1
    or (p_state_after #>> '{time,totalMinutes}')::integer <= (v_old.world_state #>> '{time,totalMinutes}')::integer
    or (p_state_after #>> '{time,totalMinutes}')::integer - (v_old.world_state #>> '{time,totalMinutes}')::integer > 1440 then
    raise exception using errcode = '22023', message = 'system_time_or_ruleset_violation';
  end if;
  if p_state_after -> 'socialIdentity' <> v_old.world_state -> 'socialIdentity'
    or p_state_after -> 'location' <> v_old.world_state -> 'location'
    or p_state_after -> 'health' <> v_old.world_state -> 'health'
    or p_state_after -> 'skills' <> v_old.world_state -> 'skills'
    or p_state_after -> 'death' <> v_old.world_state -> 'death'
    or p_state_after -> 'relationships' <> v_old.world_state -> 'relationships' then
    raise exception using errcode = '22023', message = 'system_immutable_state_violation';
  end if;
  if p_action_id <> 'conclude-chapter' and p_state_after -> 'story' <> v_old.world_state -> 'story' then
    raise exception using errcode = '22023', message = 'system_story_write_forbidden';
  end if;
  if p_action_id = 'conclude-chapter'
    and (p_state_after -> 'story') - 'chapterEnding' <> (v_old.world_state -> 'story') - 'chapterEnding' then
    raise exception using errcode = '22023', message = 'system_story_scope_violation';
  end if;

  v_old_count := coalesce((v_old.world_state #>> array['systems', 'actionCounts', p_action_id])::integer, 0);
  v_new_count := coalesce((p_state_after #>> array['systems', 'actionCounts', p_action_id])::integer, 0);
  if v_new_count <> v_old_count + 1 then
    raise exception using errcode = '22023', message = 'system_action_count_violation';
  end if;
  v_old_legacy := coalesce((v_old.world_state #>> array['systems', 'legacy', p_approach])::integer, 0);
  v_new_legacy := coalesce((p_state_after #>> array['systems', 'legacy', p_approach])::integer, 0);
  if v_new_legacy <> v_old_legacy + 1 then
    raise exception using errcode = '22023', message = 'system_legacy_violation';
  end if;

  if p_action_id not in ('trade-buy', 'trade-sell')
    and (p_state_after -> 'money' <> v_old.world_state -> 'money' or p_state_after -> 'items' <> v_old.world_state -> 'items') then
    raise exception using errcode = '22023', message = 'system_trade_scope_violation';
  end if;
  if p_action_id <> 'office-appoint' and p_state_after -> 'occupation' <> v_old.world_state -> 'occupation' then
    raise exception using errcode = '22023', message = 'system_occupation_scope_violation';
  end if;
  if p_action_id not in ('household-care', 'office-duty', 'workshop-production')
    and p_state_after -> 'reputation' <> v_old.world_state -> 'reputation' then
    raise exception using errcode = '22023', message = 'system_reputation_scope_violation';
  end if;
  if p_action_id <> 'prepare-departure' and p_state_after -> 'risks' <> v_old.world_state -> 'risks' then
    raise exception using errcode = '22023', message = 'system_risk_scope_violation';
  end if;

  if p_action_id = 'confirm-adult-age'
    and (p_state_after #>> '{systems,household,actorAge}')::integer not between 18 and 80 then
    raise exception using errcode = '22023', message = 'actor_age_required';
  elsif p_action_id = 'marriage-contract' and (
    (v_old.world_state #>> '{systems,household,actorAge}')::integer < 18
    or p_parameters ->> 'mutualConsent' <> 'true'
    or (p_parameters ->> 'partnerAge')::integer not between 18 and 80
    or p_state_after #>> '{systems,household,marriageStatus}' <> 'contracted'
    or jsonb_array_length(p_state_after #> '{systems,household,members}')
      <> jsonb_array_length(v_old.world_state #> '{systems,household,members}') + 1
  ) then
    raise exception using errcode = '22023', message = 'mutual_adult_consent_required';
  elsif p_action_id = 'register-child-care'
    and (p_state_after #>> '{systems,household,children}')::integer
      <> (v_old.world_state #>> '{systems,household,children}')::integer + 1 then
    raise exception using errcode = '22023', message = 'child_care_transition_invalid';
  elsif p_action_id = 'case-resolve'
    and (p_state_after #>> '{systems,casework,resolvedCount}')::integer
      <> (v_old.world_state #>> '{systems,casework,resolvedCount}')::integer + 1 then
    raise exception using errcode = '22023', message = 'case_resolution_invalid';
  elsif p_action_id = 'office-appoint' and p_state_after #> '{systems,office,appointment}' = 'null'::jsonb then
    raise exception using errcode = '22023', message = 'office_appointment_missing';
  elsif p_action_id = 'office-duty'
    and (p_state_after #>> '{systems,office,dutyCompleted}')::integer
      <> (v_old.world_state #>> '{systems,office,dutyCompleted}')::integer + 1 then
    raise exception using errcode = '22023', message = 'office_duty_invalid';
  elsif p_action_id = 'elite-council' and p_state_after #>> '{systems,eliteNetwork,councilAccess}' <> 'true' then
    raise exception using errcode = '22023', message = 'elite_access_missing';
  elsif p_action_id = 'governance-accession' and p_state_after #>> '{systems,governance,access}' <> 'true' then
    raise exception using errcode = '22023', message = 'governance_access_missing';
  elsif p_action_id in ('governance-revenue', 'governance-relief')
    and (p_state_after #>> '{systems,governance,policyCount}')::integer
      <> (v_old.world_state #>> '{systems,governance,policyCount}')::integer + 1 then
    raise exception using errcode = '22023', message = 'governance_policy_invalid';
  elsif p_action_id = 'conclude-chapter' and (
    v_ending_id is null
    or v_ending_id !~ '^ending-(0[1-9]|10)-0[1-5]$'
    or p_state_after #>> '{systems,activeEndingId}' <> v_ending_id
    or p_state_after #>> '{story,chapterEnding,id}' <> v_ending_id
  ) then
    raise exception using errcode = '22023', message = 'ending_transition_invalid';
  end if;

  if p_event ->> 'actionId' <> p_action_id
    or coalesce(p_event -> 'sourceIds', '[]'::jsonb) <> to_jsonb(p_source_ids) then
    raise exception using errcode = '22023', message = 'system_event_binding_invalid';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_source_ids, '{}'::text[])) source_id
    where not exists (
      select 1 from public.historical_sources source
      where source.id = source_id
        and source.scenario_id = v_old.scenario_id
        and source.published = true
    )
  ) then
    raise exception using errcode = '22023', message = 'unpublished_source_reference';
  end if;
end;
$$;

revoke all on function private.assert_phase18_system_commit(
  public.game_sessions, text, text, jsonb, jsonb, jsonb, text[]
) from public, anon, authenticated;
grant execute on function private.assert_phase18_system_commit(
  public.game_sessions, text, text, jsonb, jsonb, jsonb, text[]
) to service_role;

create or replace function public.server_commit_system_action(
  p_owner_id uuid,
  p_session_id uuid,
  p_client_action_id uuid,
  p_expected_state_version integer,
  p_action_id text,
  p_approach text,
  p_parameters jsonb,
  p_event jsonb,
  p_state_after jsonb,
  p_source_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions%rowtype;
  v_existing public.game_system_actions%rowtype;
  v_ledger_id uuid;
  v_new_version integer := p_expected_state_version + 1;
  v_snapshot jsonb;
begin
  if p_owner_id is null then
    raise exception using errcode = '22023', message = 'owner_required';
  end if;

  select * into v_existing
  from public.game_system_actions
  where owner_id = p_owner_id and client_action_id = p_client_action_id
  for update;
  if v_existing.id is not null then
    if v_existing.session_id <> p_session_id
      or v_existing.expected_state_version <> p_expected_state_version
      or v_existing.action_id <> p_action_id
      or v_existing.approach <> p_approach
      or v_existing.parameters <> coalesce(p_parameters, '{}'::jsonb) then
      raise exception using errcode = '22023', message = 'system_idempotency_mismatch';
    end if;
    return v_existing.response_snapshot || jsonb_build_object('duplicate', true);
  end if;

  select * into v_session
  from public.game_sessions
  where id = p_session_id and owner_id = p_owner_id
  for update;
  if v_session.id is null then
    raise exception using errcode = '42501', message = 'session_not_owned';
  end if;
  if v_session.state_version <> p_expected_state_version then
    raise exception using errcode = '40001', message = 'state_version_conflict';
  end if;
  if v_session.status in ('ended', 'archived')
    or v_session.world_state -> 'death' <> 'null'::jsonb
    or v_session.world_state #> '{story,chapterEnding}' <> 'null'::jsonb then
    raise exception using errcode = '22023', message = 'system_session_ended';
  end if;

  perform private.assert_phase18_system_commit(
    v_session, p_action_id, p_approach, coalesce(p_parameters, '{}'::jsonb),
    p_event, p_state_after, p_source_ids
  );

  insert into public.game_system_actions (
    session_id, owner_id, client_action_id, expected_state_version,
    committed_state_version, action_id, approach, parameters, event,
    state_before, state_after, source_ids
  ) values (
    p_session_id, p_owner_id, p_client_action_id, p_expected_state_version,
    v_new_version, p_action_id, p_approach, coalesce(p_parameters, '{}'::jsonb),
    p_event, v_session.world_state, p_state_after, p_source_ids
  ) returning id into v_ledger_id;

  update public.game_sessions
  set world_state = p_state_after,
      state_version = v_new_version,
      status = case when p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb then 'ended' else 'active' end,
      updated_at = now()
  where id = p_session_id and owner_id = p_owner_id;

  insert into public.game_checkpoints(session_id, owner_id, state_version, world_state, reason)
  values (
    p_session_id, p_owner_id, v_new_version, p_state_after,
    case when p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb then 'ending' else 'turn' end
  );

  v_snapshot := jsonb_build_object(
    'actionLedgerId', v_ledger_id,
    'stateVersion', v_new_version,
    'worldState', p_state_after,
    'event', p_event,
    'duplicate', false
  );
  update public.game_system_actions
  set response_snapshot = v_snapshot
  where id = v_ledger_id;
  return v_snapshot;
end;
$$;

revoke all on function public.server_commit_system_action(
  uuid, uuid, uuid, integer, text, text, jsonb, jsonb, jsonb, text[]
) from public, anon, authenticated;
grant execute on function public.server_commit_system_action(
  uuid, uuid, uuid, integer, text, text, jsonb, jsonb, jsonb, text[]
) to service_role;

-- Phase 16 added energy and morale in application state. Phase 18 adds systems.
-- The legacy numeric checker still receives only its original key set; the
-- outer transaction restores every newer key before commit.
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
declare
  v_result jsonb;
  v_turn_id uuid;
  v_new_version integer := p_expected_state_version + 1;
  v_content_version text;
begin
  if p_owner_id is null then
    raise exception using errcode = '22023', message = 'owner_required';
  end if;
  select content_version into v_content_version
  from public.game_sessions
  where id = p_session_id and owner_id = p_owner_id;

  perform private.assert_phase10_event_commit(
    p_owner_id, p_session_id, p_narrative, p_state_after, p_source_ids
  );
  perform set_config('request.jwt.claim.sub', p_owner_id::text, true);
  v_result := public.commit_game_turn(
    p_session_id,
    p_client_turn_id,
    p_expected_state_version,
    p_input,
    p_narrative,
    p_state_after - array['story', 'systems', 'energy', 'morale']::text[],
    p_source_ids,
    p_provider_response_id
  );
  v_turn_id := (v_result ->> 'turnId')::uuid;
  v_result := jsonb_set(v_result, '{worldState}', p_state_after, true);

  update public.game_turns set state_after = p_state_after
  where id = v_turn_id and owner_id = p_owner_id;
  update public.game_sessions
  set world_state = p_state_after,
      status = case
        when p_state_after -> 'death' <> 'null'::jsonb or p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb then 'ended'
        else 'active'
      end,
      updated_at = now()
  where id = p_session_id and owner_id = p_owner_id;
  update public.game_checkpoints
  set world_state = p_state_after,
      reason = case
        when p_state_after -> 'death' <> 'null'::jsonb or p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb then 'ending'
        else reason
      end
  where session_id = p_session_id and owner_id = p_owner_id and state_version = v_new_version;
  update public.game_turn_requests
  set response_snapshot = v_result, updated_at = now()
  where owner_id = p_owner_id and client_turn_id = p_client_turn_id;

  if p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb then
    insert into public.game_replay_summaries(
      session_id, owner_id, chapter_id, content_version, state_version, summary
    ) values (
      p_session_id,
      p_owner_id,
      p_state_after #>> '{story,chapterId}',
      v_content_version,
      v_new_version,
      jsonb_build_object(
        'decisions', p_state_after #> '{story,decisions}',
        'relationshipMemories', p_state_after #> '{story,relationshipMemories}',
        'relationships', p_state_after -> 'relationships',
        'riskClocks', p_state_after #> '{story,riskClocks}',
        'ending', p_state_after #> '{story,chapterEnding}'
      )
    )
    on conflict (session_id, owner_id, chapter_id) do update
    set content_version = excluded.content_version,
        state_version = excluded.state_version,
        summary = excluded.summary,
        updated_at = now();
  end if;
  return v_result;
end;
$$;

revoke all on function public.server_commit_game_turn(
  uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, text[], text
) from public, anon, authenticated;
grant execute on function public.server_commit_game_turn(
  uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, text[], text
) to service_role;

comment on table public.game_system_actions is
  'Immutable Phase 18 rules-engine action ledger. Direct client writes are prohibited; owner reads are RLS scoped.';
comment on function public.server_commit_system_action(
  uuid, uuid, uuid, integer, text, text, jsonb, jsonb, jsonb, text[]
) is 'Service-only idempotent system action commit with row locking, validation and checkpoint creation.';
