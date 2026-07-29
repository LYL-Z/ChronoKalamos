-- ChronoKalamos phase 14: voluntary, version-bound, privacy-minimized playtest
-- telemetry. No email, phone, IP address, user agent, free text, narrative,
-- prompt, image, payment, cookie, device fingerprint, or provider payload is
-- stored in either table.

create table if not exists public.playtest_enrollments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_release text not null check (app_release = '36'),
  content_version text not null check (content_version = '11.0.0'),
  scenario_id text not null check (scenario_id = 'tang-changan-742'),
  scenario_version text not null check (scenario_version = '1.0.0'),
  consent_version text not null check (consent_version = 'phase14-v1'),
  cohort text not null check (cohort = 'small-public-beta'),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, app_release, content_version, scenario_version),
  unique (id, owner_id)
);

create table if not exists public.playtest_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_session_id uuid references public.game_sessions(id) on delete cascade,
  event_key text not null check (
    char_length(event_key) between 3 and 100
    and event_key ~ '^[a-z0-9:_-]+$'
  ),
  app_release text not null check (app_release = '36'),
  content_version text not null check (content_version = '11.0.0'),
  scenario_id text not null check (scenario_id = 'tang-changan-742'),
  scenario_version text not null check (scenario_version = '1.0.0'),
  event_name text not null check (
    event_name in (
      'session_started',
      'choice_submitted',
      'turn_committed',
      'turn_failed',
      'recovery_attempted',
      'recovery_completed',
      'client_error',
      'player_exit'
    )
  ),
  origin_id text check (origin_id is null or origin_id in ('merchant', 'craft', 'clerk')),
  event_id text check (event_id is null or event_id ~ '^[a-z0-9-]{1,80}$'),
  choice_id text check (choice_id is null or choice_id ~ '^choice-[1-5]$'),
  input_kind text check (input_kind is null or input_kind in ('choice', 'free_text')),
  turn_number smallint check (turn_number is null or turn_number between 0 and 40),
  flow_id uuid,
  latency_ms integer check (latency_ms is null or latency_ms between 0 and 300000),
  result_code text check (
    result_code is null
    or (
      char_length(result_code) between 1 and 64
      and result_code ~ '^[a-z0-9_:-]+$'
    )
  ),
  exit_point text check (
    exit_point is null
    or exit_point in (
      'setup_closed',
      'game_back_home',
      'page_hidden',
      'save_restore_failed'
    )
  ),
  recovery_path text check (
    recovery_path is null
    or recovery_path in ('turn_retry', 'save_restore', 'network_reconnect')
  ),
  source_count smallint check (source_count is null or source_count between 0 and 8),
  classification text check (
    classification is null
    or classification in ('record', 'reconstruction', 'fiction')
  ),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, owner_id)
    references public.playtest_enrollments(id, owner_id)
    on delete cascade,
  unique (owner_id, event_key)
);

alter table public.playtest_enrollments enable row level security;
alter table public.playtest_events enable row level security;

revoke all on table public.playtest_enrollments from public, anon, authenticated;
revoke all on table public.playtest_events from public, anon, authenticated;

grant select, delete on table public.playtest_enrollments to authenticated;
grant insert (
  owner_id,
  app_release,
  content_version,
  scenario_id,
  scenario_version,
  consent_version,
  cohort
) on table public.playtest_enrollments to authenticated;
grant select, delete on table public.playtest_events to authenticated;
grant select, insert, update, delete on table public.playtest_enrollments to service_role;
grant select, insert, update, delete on table public.playtest_events to service_role;

drop policy if exists playtest_enrollments_select_own on public.playtest_enrollments;
create policy playtest_enrollments_select_own
  on public.playtest_enrollments
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists playtest_enrollments_insert_own on public.playtest_enrollments;
create policy playtest_enrollments_insert_own
  on public.playtest_enrollments
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = owner_id
    and app_release = '36'
    and content_version = '11.0.0'
    and scenario_id = 'tang-changan-742'
    and scenario_version = '1.0.0'
    and consent_version = 'phase14-v1'
    and cohort = 'small-public-beta'
  );

drop policy if exists playtest_enrollments_delete_own on public.playtest_enrollments;
create policy playtest_enrollments_delete_own
  on public.playtest_enrollments
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists playtest_events_select_own on public.playtest_events;
create policy playtest_events_select_own
  on public.playtest_events
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists playtest_events_delete_own on public.playtest_events;
create policy playtest_events_delete_own
  on public.playtest_events
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create index if not exists playtest_enrollments_owner_idx
  on public.playtest_enrollments (owner_id);
create index if not exists playtest_events_enrollment_time_idx
  on public.playtest_events (enrollment_id, occurred_at);
create index if not exists playtest_events_release_name_idx
  on public.playtest_events (
    app_release,
    content_version,
    scenario_version,
    event_name,
    occurred_at
  );
create index if not exists playtest_events_session_idx
  on public.playtest_events (game_session_id)
  where game_session_id is not null;

comment on table public.playtest_enrollments is
  'Voluntary phase 14 consent record bound to one release and content version; deleting it cascades all associated playtest events.';
comment on table public.playtest_events is
  'Sparse phase 14 product events. Raw player text, narrative, direct identifiers, IP addresses and device fingerprints are prohibited.';
