-- ChronoKalamos phase 10: versioned event registry, authoritative consequence
-- binding, chapter memory, risk clocks, and replay summaries.

create table if not exists public.scenario_manifests (
  scenario_id text primary key
    check (scenario_id = 'tang-changan-742'),
  content_version text not null
    check (content_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  era_start integer not null,
  era_end integer not null,
  locations text[] not null,
  origins text[] not null,
  evidence_policy text not null
    check (evidence_policy = 'source_required'),
  first_event_by_origin jsonb not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (era_start = 742 and era_end = 742),
  check (cardinality(origins) = 3),
  check (jsonb_typeof(first_event_by_origin) = 'object')
);

create table if not exists public.event_template_registry (
  event_id text primary key
    check (event_id ~ '^[a-z0-9-]{1,80}$'),
  scenario_id text not null
    references public.scenario_manifests(scenario_id) on delete cascade,
  chapter_id text not null
    check (chapter_id ~ '^[a-z0-9-]{1,80}$'),
  origin_ids text[] not null,
  choice_ids text[] not null,
  consequence_keys text[] not null,
  next_event_ids text[] not null,
  evidence_refs text[] not null,
  classification text not null
    check (classification in ('史料记载', '合理重建', '叙事虚构')),
  publication_status text not null
    check (publication_status in ('draft', 'provisional', 'reviewed', 'published')),
  content_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(origin_ids) between 1 and 3),
  check (cardinality(choice_ids) between 3 and 5),
  check (cardinality(choice_ids) = cardinality(consequence_keys)),
  check (cardinality(choice_ids) = cardinality(next_event_ids)),
  check (cardinality(evidence_refs) between 1 and 8)
);

create index if not exists event_template_registry_scenario_idx
  on public.event_template_registry(scenario_id, publication_status, chapter_id);

create table if not exists public.game_replay_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null,
  content_version text not null,
  state_version integer not null check (state_version > 0),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, owner_id, chapter_id),
  foreign key (session_id, owner_id)
    references public.game_sessions(id, owner_id) on delete cascade
);

create index if not exists game_replay_summaries_owner_updated_idx
  on public.game_replay_summaries(owner_id, updated_at desc);

alter table public.scenario_manifests enable row level security;
alter table public.event_template_registry enable row level security;
alter table public.game_replay_summaries enable row level security;

drop policy if exists scenario_manifests_read_published
  on public.scenario_manifests;
create policy scenario_manifests_read_published
  on public.scenario_manifests
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists event_template_registry_read_published
  on public.event_template_registry;
create policy event_template_registry_read_published
  on public.event_template_registry
  for select
  to anon, authenticated
  using (publication_status = 'published');

drop policy if exists game_replay_summaries_select_own
  on public.game_replay_summaries;
create policy game_replay_summaries_select_own
  on public.game_replay_summaries
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.scenario_manifests from public, anon, authenticated;
revoke all on public.event_template_registry from public, anon, authenticated;
revoke all on public.game_replay_summaries from public, anon, authenticated;
grant select on public.scenario_manifests to anon, authenticated;
grant select on public.event_template_registry to anon, authenticated;
grant select on public.game_replay_summaries to authenticated;
grant select, insert, update, delete on public.scenario_manifests to service_role;
grant select, insert, update, delete on public.event_template_registry to service_role;
grant select, insert, update, delete on public.game_replay_summaries to service_role;

insert into public.scenario_manifests (
  scenario_id,
  content_version,
  era_start,
  era_end,
  locations,
  origins,
  evidence_policy,
  first_event_by_origin,
  published
)
values (
  'tang-changan-742',
  '10.0.0',
  742,
  742,
  array['western-market', 'craft-ward', 'jingzhao-fu'],
  array['merchant', 'craft', 'clerk'],
  'source_required',
  jsonb_build_object(
    'merchant', 'merchant-ledger-mark',
    'craft', 'craft-material-shortfall',
    'clerk', 'clerk-ambiguous-place'
  ),
  true
)
on conflict (scenario_id) do update
set content_version = excluded.content_version,
    era_start = excluded.era_start,
    era_end = excluded.era_end,
    locations = excluded.locations,
    origins = excluded.origins,
    evidence_policy = excluded.evidence_policy,
    first_event_by_origin = excluded.first_event_by_origin,
    published = excluded.published,
    updated_at = now();

insert into public.event_template_registry (
  event_id,
  scenario_id,
  chapter_id,
  origin_ids,
  choice_ids,
  consequence_keys,
  next_event_ids,
  evidence_refs,
  classification,
  publication_status,
  content_version
)
values
  (
    'merchant-ledger-mark', 'tang-changan-742', 'merchant-first-ledger',
    array['merchant'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['merchant-ledger-audit', 'merchant-market-rush', 'merchant-time-boundary'],
    array['merchant-gate-window', 'merchant-gate-window', 'merchant-gate-window'],
    array['S-003', 'S-004', 'S-005'],
    '合理重建', 'published', '10.0.0'
  ),
  (
    'merchant-gate-window', 'tang-changan-742', 'merchant-first-ledger',
    array['merchant'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['merchant-shared-audit', 'merchant-buy-time', 'merchant-solo-settlement'],
    array['merchant-settlement', 'merchant-settlement', 'merchant-settlement'],
    array['S-003', 'S-004', 'S-007'],
    '合理重建', 'published', '10.0.0'
  ),
  (
    'merchant-settlement', 'tang-changan-742', 'merchant-first-ledger',
    array['merchant'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['merchant-record-uncertainty', 'merchant-protect-credit', 'merchant-shift-blame'],
    array[null, null, null]::text[],
    array['S-003', 'S-004', 'S-005'],
    '叙事虚构', 'published', '10.0.0'
  ),
  (
    'craft-material-shortfall', 'tang-changan-742', 'craft-first-commission',
    array['craft'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['craft-recount-materials', 'craft-report-early', 'craft-substitute-material'],
    array['craft-mentor-pressure', 'craft-mentor-pressure', 'craft-mentor-pressure'],
    array['S-003', 'S-004', 'S-008'],
    '合理重建', 'published', '10.0.0'
  ),
  (
    'craft-mentor-pressure', 'tang-changan-742', 'craft-first-commission',
    array['craft'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['craft-staged-delivery', 'craft-buy-materials', 'craft-overwork'],
    array['craft-delivery', 'craft-delivery', 'craft-delivery'],
    array['S-003', 'S-004', 'S-008'],
    '合理重建', 'published', '10.0.0'
  ),
  (
    'craft-delivery', 'tang-changan-742', 'craft-first-commission',
    array['craft'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['craft-credit-workers', 'craft-mentor-credit', 'craft-claim-invention'],
    array[null, null, null]::text[],
    array['S-003', 'S-004', 'S-008'],
    '叙事虚构', 'published', '10.0.0'
  ),
  (
    'clerk-ambiguous-place', 'tang-changan-742', 'clerk-first-dispatch',
    array['clerk'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['clerk-compare-records', 'clerk-consult-scribe', 'clerk-guess-copy'],
    array['clerk-delivery-range', 'clerk-delivery-range', 'clerk-delivery-range'],
    array['S-002', 'S-006', 'S-008'],
    '合理重建', 'published', '10.0.0'
  ),
  (
    'clerk-delivery-range', 'tang-changan-742', 'clerk-first-dispatch',
    array['clerk'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['clerk-request-clarification', 'clerk-mark-uncertainty', 'clerk-oral-fix'],
    array['clerk-register', 'clerk-register', 'clerk-register'],
    array['S-002', 'S-006', 'S-008'],
    '合理重建', 'published', '10.0.0'
  ),
  (
    'clerk-register', 'tang-changan-742', 'clerk-first-dispatch',
    array['clerk'],
    array['choice-1', 'choice-2', 'choice-3'],
    array['clerk-register-uncertainty', 'clerk-correct-without-trace', 'clerk-transfer-responsibility'],
    array[null, null, null]::text[],
    array['S-002', 'S-006', 'S-008'],
    '叙事虚构', 'published', '10.0.0'
  )
on conflict (event_id) do update
set scenario_id = excluded.scenario_id,
    chapter_id = excluded.chapter_id,
    origin_ids = excluded.origin_ids,
    choice_ids = excluded.choice_ids,
    consequence_keys = excluded.consequence_keys,
    next_event_ids = excluded.next_event_ids,
    evidence_refs = excluded.evidence_refs,
    classification = excluded.classification,
    publication_status = excluded.publication_status,
    content_version = excluded.content_version,
    updated_at = now();

create or replace function private.phase10_initial_story(
  p_origin text,
  p_turn integer
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'chapterId',
      case p_origin
        when 'merchant' then 'merchant-first-ledger'
        when 'craft' then 'craft-first-commission'
        else 'clerk-first-dispatch'
      end,
    'currentEventId',
      case p_origin
        when 'merchant' then
          case when p_turn <= 0 then 'merchant-ledger-mark'
               when p_turn = 1 then 'merchant-gate-window'
               else 'merchant-settlement' end
        when 'craft' then
          case when p_turn <= 0 then 'craft-material-shortfall'
               when p_turn = 1 then 'craft-mentor-pressure'
               else 'craft-delivery' end
        else
          case when p_turn <= 0 then 'clerk-ambiguous-place'
               when p_turn = 1 then 'clerk-delivery-range'
               else 'clerk-register' end
      end,
    'completedEventIds', '[]'::jsonb,
    'decisions', '[]'::jsonb,
    'relationshipMemories', '[]'::jsonb,
    'riskClocks', '[]'::jsonb,
    'chapterEnding',
      case when p_turn >= 3 then jsonb_build_object(
        'id', 'legacy-session-boundary',
        'title', '旧版存档的章节边界',
        'summary', '该存档产生于事件模板启用前。旧回合无法可靠重建为新的因果链，请从同一出身创建新存档重玩。',
        'classification', '叙事虚构',
        'sourceIds', jsonb_build_array('S-001')
      ) else 'null'::jsonb end
  );
$$;

revoke all on function private.phase10_initial_story(text, integer)
  from public, anon, authenticated;

update public.game_sessions
set world_state = jsonb_set(
  world_state,
  '{story}',
  private.phase10_initial_story(
    coalesce(world_state ->> 'socialIdentity', character_profile ->> 'origin'),
    coalesce((world_state #>> '{time,turn}')::integer, state_version)
  ),
  true
)
where not (world_state ? 'story');

update public.game_sessions
set status = 'ended',
    updated_at = now()
where world_state #> '{story,chapterEnding}' <> 'null'::jsonb
  and status not in ('ended', 'archived');

update public.game_checkpoints checkpoint
set world_state = jsonb_set(
  checkpoint.world_state,
  '{story}',
  private.phase10_initial_story(
    coalesce(checkpoint.world_state ->> 'socialIdentity', session.character_profile ->> 'origin'),
    coalesce((checkpoint.world_state #>> '{time,turn}')::integer, checkpoint.state_version)
  ),
  true
)
from public.game_sessions session
where checkpoint.session_id = session.id
  and not (checkpoint.world_state ? 'story');

update public.game_turns turn_row
set state_before = jsonb_set(
      turn_row.state_before,
      '{story}',
      private.phase10_initial_story(
        coalesce(turn_row.state_before ->> 'socialIdentity', session.character_profile ->> 'origin'),
        coalesce((turn_row.state_before #>> '{time,turn}')::integer, turn_row.turn_number - 1)
      ),
      true
    ),
    state_after = jsonb_set(
      turn_row.state_after,
      '{story}',
      private.phase10_initial_story(
        coalesce(turn_row.state_after ->> 'socialIdentity', session.character_profile ->> 'origin'),
        coalesce((turn_row.state_after #>> '{time,turn}')::integer, turn_row.turn_number)
      ),
      true
    )
from public.game_sessions session
where turn_row.session_id = session.id
  and (not (turn_row.state_before ? 'story') or not (turn_row.state_after ? 'story'));

update public.game_turn_requests request
set response_snapshot = jsonb_set(
      request.response_snapshot,
      '{worldState}',
      jsonb_set(
        request.response_snapshot -> 'worldState',
        '{story}',
        private.phase10_initial_story(
          coalesce(
            request.response_snapshot #>> '{worldState,socialIdentity}',
            session.character_profile ->> 'origin'
          ),
          coalesce(
            (request.response_snapshot #>> '{worldState,time,turn}')::integer,
            request.expected_state_version + 1
          )
        ),
        true
      ),
      true
    ),
    updated_at = now()
from public.game_sessions session
where request.session_id = session.id
  and request.status = 'committed'
  and jsonb_typeof(request.response_snapshot) = 'object'
  and jsonb_typeof(request.response_snapshot -> 'worldState') = 'object'
  and not ((request.response_snapshot -> 'worldState') ? 'story');

create or replace function private.create_or_get_game_session_guarded(
  p_client_session_id uuid,
  p_origin_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_session_id uuid;
begin
  if not private.session_meets_mfa() then
    raise exception using errcode = '42501', message = 'mfa_required';
  end if;

  v_result := private.create_or_get_game_session_unchecked(
    p_client_session_id,
    p_origin_id
  );
  v_session_id := (v_result ->> 'id')::uuid;

  update public.game_sessions
  set world_state = jsonb_set(
        world_state,
        '{story}',
        private.phase10_initial_story(
          coalesce(world_state ->> 'socialIdentity', character_profile ->> 'origin'),
          coalesce((world_state #>> '{time,turn}')::integer, state_version)
        ),
        true
      ),
      updated_at = now()
  where id = v_session_id
    and owner_id = auth.uid()
    and not (world_state ? 'story');

  select to_jsonb(session_row)
  into v_result
  from public.game_sessions session_row
  where session_row.id = v_session_id
    and session_row.owner_id = auth.uid();

  if v_result is null then
    raise exception using errcode = '42501', message = 'session_not_owned';
  end if;
  return v_result;
end;
$$;

revoke all on function private.create_or_get_game_session_guarded(uuid, text)
  from public, anon;
grant execute on function private.create_or_get_game_session_guarded(uuid, text)
  to authenticated;

create or replace function private.assert_phase10_event_commit(
  p_owner_id uuid,
  p_session_id uuid,
  p_narrative jsonb,
  p_state_after jsonb,
  p_source_ids text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.game_sessions%rowtype;
  v_event public.event_template_registry%rowtype;
  v_event_id text := p_narrative ->> 'eventId';
  v_choice_id text := p_narrative ->> 'resolvedChoiceId';
  v_consequence_key text := p_narrative ->> 'consequenceKey';
  v_choice_index integer;
  v_expected_next_event text;
begin
  if v_event_id is null or v_choice_id is null or v_consequence_key is null then
    raise exception using errcode = '22023', message = 'phase10_event_binding_required';
  end if;
  if jsonb_typeof(p_state_after -> 'story') <> 'object' then
    raise exception using errcode = '22023', message = 'phase10_story_state_required';
  end if;

  select *
  into v_session
  from public.game_sessions
  where id = p_session_id
    and owner_id = p_owner_id;
  if v_session.id is null then
    raise exception using errcode = '42501', message = 'session_not_owned';
  end if;
  if v_session.world_state #>> '{story,currentEventId}' <> v_event_id then
    raise exception using errcode = '22023', message = 'event_state_mismatch';
  end if;

  select *
  into v_event
  from public.event_template_registry
  where event_id = v_event_id
    and scenario_id = v_session.scenario_id
    and publication_status = 'published';
  if v_event.event_id is null then
    raise exception using errcode = '22023', message = 'event_not_published';
  end if;
  if not ((v_session.world_state ->> 'socialIdentity') = any(v_event.origin_ids)) then
    raise exception using errcode = '22023', message = 'event_origin_violation';
  end if;

  v_choice_index := array_position(v_event.choice_ids, v_choice_id);
  if v_choice_index is null
    or v_event.consequence_keys[v_choice_index] <> v_consequence_key then
    raise exception using errcode = '22023', message = 'event_consequence_mismatch';
  end if;

  v_expected_next_event := v_event.next_event_ids[v_choice_index];
  if v_expected_next_event is null then
    if p_state_after #> '{story,chapterEnding}' is null
      or p_state_after #> '{story,chapterEnding}' = 'null'::jsonb
      or p_state_after #>> '{story,currentEventId}' <> v_event_id then
      raise exception using errcode = '22023', message = 'chapter_ending_required';
    end if;
  elsif p_state_after #>> '{story,currentEventId}' <> v_expected_next_event
    or p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb then
    raise exception using errcode = '22023', message = 'next_event_mismatch';
  end if;

  if not ((p_state_after #> '{story,completedEventIds}') ? v_event_id) then
    raise exception using errcode = '22023', message = 'completed_event_missing';
  end if;
  if p_state_after #>> '{story,decisions,-1,consequenceKey}' <> v_consequence_key then
    raise exception using errcode = '22023', message = 'decision_memory_mismatch';
  end if;
  if coalesce(p_source_ids, '{}'::text[]) <> array(
    select jsonb_array_elements_text(p_narrative -> 'sourceIds')
  ) then
    raise exception using errcode = '22023', message = 'narrative_source_mismatch';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_source_ids, '{}'::text[])) source_id
    where not (source_id = any(v_event.evidence_refs))
  ) then
    raise exception using errcode = '22023', message = 'source_outside_event';
  end if;
end;
$$;

revoke all on function private.assert_phase10_event_commit(uuid, uuid, jsonb, jsonb, text[])
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.assert_phase10_event_commit(uuid, uuid, jsonb, jsonb, text[])
  to service_role;

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
begin
  if p_owner_id is null then
    raise exception using errcode = '22023', message = 'owner_required';
  end if;

  perform private.assert_phase10_event_commit(
    p_owner_id,
    p_session_id,
    p_narrative,
    p_state_after,
    p_source_ids
  );
  perform set_config('request.jwt.claim.sub', p_owner_id::text, true);

  -- Reuse the phase-5 transaction and numeric boundary checks. The legacy
  -- function does not yet know the story key, so the wrapper restores that key
  -- before this outer transaction commits.
  v_result := public.commit_game_turn(
    p_session_id,
    p_client_turn_id,
    p_expected_state_version,
    p_input,
    p_narrative,
    p_state_after - 'story',
    p_source_ids,
    p_provider_response_id
  );
  v_turn_id := (v_result ->> 'turnId')::uuid;
  v_result := jsonb_set(v_result, '{worldState}', p_state_after, true);

  update public.game_turns
  set state_after = p_state_after
  where id = v_turn_id
    and owner_id = p_owner_id;

  update public.game_sessions
  set world_state = p_state_after,
      status = case
        when p_state_after -> 'death' is not null
          or p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb
        then 'ended'
        else 'active'
      end,
      updated_at = now()
  where id = p_session_id
    and owner_id = p_owner_id;

  update public.game_checkpoints
  set world_state = p_state_after,
      reason = case
        when p_state_after -> 'death' is not null
          or p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb
        then 'ending'
        else reason
      end
  where session_id = p_session_id
    and owner_id = p_owner_id
    and state_version = v_new_version;

  update public.game_turn_requests
  set response_snapshot = v_result,
      updated_at = now()
  where owner_id = p_owner_id
    and client_turn_id = p_client_turn_id;

  if p_state_after #> '{story,chapterEnding}' <> 'null'::jsonb then
    insert into public.game_replay_summaries (
      session_id,
      owner_id,
      chapter_id,
      content_version,
      state_version,
      summary
    )
    values (
      p_session_id,
      p_owner_id,
      p_state_after #>> '{story,chapterId}',
      '10.0.0',
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
