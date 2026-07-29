-- Phase 11 public-beta release.
--
-- Runtime availability is deliberately independent from historical review.
-- The 27 Phase 11 events are playable, but their historical content remains
-- provisional and the external historian review status remains pending.

alter table public.content_candidate_versions
  drop constraint if exists content_candidate_versions_public_runtime_enabled_check;

alter table public.content_candidate_versions
  add column if not exists release_mode text not null default 'private-candidate'
    check (release_mode in ('private-candidate', 'public-beta-unreviewed')),
  add column if not exists historical_certification_claimed boolean not null default false
    check (not historical_certification_claimed),
  add column if not exists public_disclaimer_zh text,
  add column if not exists public_disclaimer_en text;

update public.content_candidate_versions
set review_status = 'pending',
    release_mode = 'public-beta-unreviewed',
    historical_certification_claimed = false,
    public_runtime_enabled = true,
    public_disclaimer_zh =
      'Phase 11 公开测试版；尚未经外部历史学家认证。所有新增史实内容仍为 provisional，并保留来源、分类与不确定性说明。',
    public_disclaimer_en =
      'Phase 11 public beta; external historian certification is pending. All new historical content remains provisional with sources, classifications, and uncertainty notes.',
    updated_at = now()
where scenario_id = 'tang-changan-742'
  and content_version = '11.0.0';

alter table public.content_candidate_versions
  drop constraint if exists content_candidate_versions_public_beta_disclaimer_check;
alter table public.content_candidate_versions
  add constraint content_candidate_versions_public_beta_disclaimer_check
  check (
    not public_runtime_enabled
    or (
      release_mode = 'public-beta-unreviewed'
      and review_status = 'pending'
      and historical_certification_claimed = false
      and public_disclaimer_zh is not null
      and public_disclaimer_en is not null
    )
  );

alter table public.event_template_registry
  add column if not exists runtime_availability text not null default 'disabled'
    check (runtime_availability in ('disabled', 'public-beta', 'public'));

update public.event_template_registry
set runtime_availability = 'public'
where content_version = '10.0.0'
  and publication_status = 'published';

alter table public.event_template_registry
  drop constraint if exists event_template_registry_pkey;
alter table public.event_template_registry
  add constraint event_template_registry_pkey
  primary key (content_version, event_id);

drop index if exists public.event_template_registry_scenario_idx;
create index event_template_registry_scenario_idx
  on public.event_template_registry(
    scenario_id,
    content_version,
    runtime_availability,
    chapter_id
  );

drop policy if exists event_template_registry_read_published
  on public.event_template_registry;
create policy event_template_registry_read_runtime
  on public.event_template_registry
  for select
  to anon, authenticated
  using (runtime_availability in ('public-beta', 'public'));

update public.scenario_manifests
set content_version = '11.0.0',
    locations = array[
      'western-market',
      'jin-guang-gate',
      'jingzhao-fu',
      'daming-palace',
      'craft-ward',
      'eastern-market',
      'mingde-gate',
      'imperial-city'
    ],
    first_event_by_origin = jsonb_build_object(
      'merchant', 'merchant-ledger-mark',
      'craft', 'craft-material-shortfall',
      'clerk', 'clerk-ambiguous-place'
    ),
    published = true,
    updated_at = now()
where scenario_id = 'tang-changan-742';

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
  runtime_availability,
  content_version
)
select
  entry.payload ->> 'eventId',
  entry.scenario_id,
  entry.payload ->> 'chapterId',
  array[entry.payload ->> 'originId'],
  array(
    select choice.value ->> 'id'
    from jsonb_array_elements(entry.payload -> 'choices')
      with ordinality as choice(value, position)
    order by choice.position
  ),
  array(
    select (entry.payload ->> 'eventId') || '-' || (choice.value ->> 'id')
    from jsonb_array_elements(entry.payload -> 'choices')
      with ordinality as choice(value, position)
    order by choice.position
  ),
  array(
    select choice.value ->> 'nextEventId'
    from jsonb_array_elements(entry.payload -> 'choices')
      with ordinality as choice(value, position)
    order by choice.position
  ),
  array(
    select jsonb_array_elements_text(entry.payload -> 'evidenceRefs')
  ),
  entry.payload ->> 'classification',
  'provisional',
  'public-beta',
  entry.content_version
from public.content_candidate_entries entry
where entry.scenario_id = 'tang-changan-742'
  and entry.content_version = '11.0.0'
  and entry.entry_type = 'event'
on conflict (content_version, event_id) do update
set scenario_id = excluded.scenario_id,
    chapter_id = excluded.chapter_id,
    origin_ids = excluded.origin_ids,
    choice_ids = excluded.choice_ids,
    consequence_keys = excluded.consequence_keys,
    next_event_ids = excluded.next_event_ids,
    evidence_refs = excluded.evidence_refs,
    classification = excluded.classification,
    publication_status = excluded.publication_status,
    runtime_availability = excluded.runtime_availability,
    updated_at = now();

alter table public.game_sessions
  add column if not exists content_version text not null default '10.0.0'
    check (content_version in ('10.0.0', '11.0.0'));

-- A never-started draft has no player-authored consequence to preserve and can
-- safely enter Phase 11. Progressed sessions remain pinned to Phase 10.
update public.game_sessions
set content_version = '11.0.0',
    world_state = jsonb_set(
      world_state,
      '{story,chapterId}',
      to_jsonb(
        case character_profile ->> 'origin'
          when 'merchant' then 'merchant-ledger-day'
          when 'craft' then 'craft-first-commission'
          else 'clerk-first-dispatch'
        end
      ),
      true
    ),
    updated_at = now()
where content_version = '10.0.0'
  and state_version = 0
  and status = 'draft';

alter table public.game_sessions
  alter column content_version set default '11.0.0';

create or replace function private.phase11_initial_story(
  p_origin text
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
        when 'merchant' then 'merchant-ledger-day'
        when 'craft' then 'craft-first-commission'
        else 'clerk-first-dispatch'
      end,
    'currentEventId',
      case p_origin
        when 'merchant' then 'merchant-ledger-mark'
        when 'craft' then 'craft-material-shortfall'
        else 'clerk-ambiguous-place'
      end,
    'completedEventIds', '[]'::jsonb,
    'decisions', '[]'::jsonb,
    'relationshipMemories', '[]'::jsonb,
    'riskClocks', '[]'::jsonb,
    'chapterEnding', 'null'::jsonb
  );
$$;

revoke all on function private.phase11_initial_story(text)
  from public, anon, authenticated;

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
        case content_version
          when '11.0.0' then private.phase11_initial_story(
            coalesce(world_state ->> 'socialIdentity', character_profile ->> 'origin')
          )
          else private.phase10_initial_story(
            coalesce(world_state ->> 'socialIdentity', character_profile ->> 'origin'),
            coalesce((world_state #>> '{time,turn}')::integer, state_version)
          )
        end,
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
    raise exception using errcode = '22023', message = 'event_binding_required';
  end if;
  if jsonb_typeof(p_state_after -> 'story') <> 'object' then
    raise exception using errcode = '22023', message = 'story_state_required';
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
    and content_version = v_session.content_version
    and runtime_availability in ('public-beta', 'public');
  if v_event.event_id is null then
    raise exception using errcode = '22023', message = 'event_not_runtime_available';
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

comment on function private.assert_phase10_event_commit(uuid, uuid, jsonb, jsonb, text[]) is
  'Compatibility function name retained for deployed callers. Validates the session-pinned Phase 10 or Phase 11 runtime catalog.';
