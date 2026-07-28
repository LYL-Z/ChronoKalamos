-- Phase 11 keeps unreviewed historical content outside the published runtime
-- registry. A later, explicit release migration may copy approved rows into
-- public.scenario_manifests and public.event_template_registry.

create table if not exists public.content_candidate_versions (
  scenario_id text not null,
  content_version text not null,
  runtime_fallback_version text not null,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'changes-requested', 'approved')),
  external_review_required boolean not null default true
    check (external_review_required),
  public_runtime_enabled boolean not null default false
    check (not public_runtime_enabled),
  expected_counts jsonb not null,
  source_commit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scenario_id, content_version)
);

create table if not exists public.content_candidate_entries (
  scenario_id text not null,
  content_version text not null,
  entry_type text not null
    check (entry_type in ('chapter', 'event', 'npc', 'item', 'risk', 'claim', 'map-feature')),
  entry_id text not null,
  publication_status text not null default 'provisional'
    check (publication_status in ('draft', 'provisional', 'reviewed')),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scenario_id, content_version, entry_type, entry_id),
  foreign key (scenario_id, content_version)
    references public.content_candidate_versions (scenario_id, content_version)
    on delete cascade
);

create table if not exists public.historian_content_reviews (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null,
  content_version text not null,
  reviewer_name text not null,
  reviewer_affiliation text not null,
  reviewer_contact_hash text not null check (reviewer_contact_hash ~ '^[a-f0-9]{64}$'),
  scope text not null,
  decision text not null check (decision in ('changes-requested', 'approved')),
  evidence_artifact text not null,
  reviewed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  foreign key (scenario_id, content_version)
    references public.content_candidate_versions (scenario_id, content_version)
    on delete cascade
);

create unique index if not exists historian_content_reviews_unique_evidence
  on public.historian_content_reviews (scenario_id, content_version, evidence_artifact);

alter table public.content_candidate_versions enable row level security;
alter table public.content_candidate_entries enable row level security;
alter table public.historian_content_reviews enable row level security;

-- Candidate and reviewer data are server-only. No anon/authenticated policies
-- are created. Explicit privileges are required because new Supabase projects
-- no longer auto-expose public tables to the Data API.
revoke all on table public.content_candidate_versions from public, anon, authenticated;
revoke all on table public.content_candidate_entries from public, anon, authenticated;
revoke all on table public.historian_content_reviews from public, anon, authenticated;

grant select, insert, update, delete on table public.content_candidate_versions to service_role;
grant select, insert, update, delete on table public.content_candidate_entries to service_role;
grant select, insert, update, delete on table public.historian_content_reviews to service_role;

insert into public.content_candidate_versions (
  scenario_id,
  content_version,
  runtime_fallback_version,
  review_status,
  external_review_required,
  public_runtime_enabled,
  expected_counts
) values (
  'tang-changan-742',
  '11.0.0',
  '10.0.0',
  'pending',
  true,
  false,
  '{"chapters":3,"events":27,"choices":81,"npcs":12,"items":9,"risks":6,"provisionalClaims":27,"provisionalMapFeatures":3}'::jsonb
)
on conflict (scenario_id, content_version) do update
set runtime_fallback_version = excluded.runtime_fallback_version,
    review_status = 'pending',
    external_review_required = true,
    public_runtime_enabled = false,
    expected_counts = excluded.expected_counts,
    updated_at = now();
