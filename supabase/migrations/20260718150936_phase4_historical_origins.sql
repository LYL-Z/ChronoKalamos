-- ChronoKalamos phase 4: publish the three bounded origins through Supabase.
-- JSON remains the authoring source; these rows are the browser-readable mirror.

create table if not exists public.historical_origins (
  id text primary key,
  scenario_id text not null default 'tang-changan-742',
  code text not null,
  title text not null,
  english text not null,
  detail text not null,
  classification text not null,
  source_ids text[] not null default '{}'::text[],
  claim_ids text[] not null default '{}'::text[],
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historical_origins_id_check check (id in ('merchant', 'craft', 'clerk')),
  constraint historical_origins_code_check check (code in ('O-01', 'O-02', 'O-03')),
  constraint historical_origins_classification_check check (classification in ('史料记载', '合理重建', '叙事虚构')),
  constraint historical_origins_source_check check (cardinality(source_ids) > 0),
  constraint historical_origins_claim_check check (cardinality(claim_ids) > 0)
);

create table if not exists public.historical_origin_sources (
  origin_id text not null references public.historical_origins (id) on delete cascade,
  source_id text not null references public.historical_sources (id) on delete restrict,
  primary key (origin_id, source_id)
);

create table if not exists public.historical_origin_claims (
  origin_id text not null references public.historical_origins (id) on delete cascade,
  claim_id text not null references public.historical_claims (id) on delete restrict,
  primary key (origin_id, claim_id)
);

alter table public.historical_origins enable row level security;
alter table public.historical_origin_sources enable row level security;
alter table public.historical_origin_claims enable row level security;

revoke all on table
  public.historical_origins,
  public.historical_origin_sources,
  public.historical_origin_claims
from anon, authenticated;

grant select on table
  public.historical_origins,
  public.historical_origin_sources,
  public.historical_origin_claims
to anon, authenticated;

drop policy if exists "historical_origins_read_published" on public.historical_origins;
create policy "historical_origins_read_published" on public.historical_origins
  for select to anon, authenticated using (published = true);

drop policy if exists "historical_origin_sources_read_published" on public.historical_origin_sources;
create policy "historical_origin_sources_read_published" on public.historical_origin_sources
  for select to anon, authenticated using (
    exists (
      select 1 from public.historical_origins origin
      where origin.id = historical_origin_sources.origin_id and origin.published = true
    )
  );

drop policy if exists "historical_origin_claims_read_published" on public.historical_origin_claims;
create policy "historical_origin_claims_read_published" on public.historical_origin_claims
  for select to anon, authenticated using (
    exists (
      select 1 from public.historical_origins origin
      where origin.id = historical_origin_claims.origin_id and origin.published = true
    )
  );

create index if not exists historical_origins_scenario_published_idx
  on public.historical_origins (scenario_id, published);
create index if not exists historical_origin_sources_source_id_idx
  on public.historical_origin_sources (source_id);
create index if not exists historical_origin_claims_claim_id_idx
  on public.historical_origin_claims (claim_id);

insert into public.historical_origins
  (id, code, title, english, detail, classification, source_ids, claim_ids, published)
values
  ('merchant', 'O-01', $$西市粟特商户家庭后辈$$, $$Sogdian merchant household$$, $$在西市的往来、账簿和多语交易中长大；家庭与个人细节均是叙事参数。$$, $$合理重建$$, array['S-004','S-005'], array['C-O01-001','C-O01-002'], true),
  ('craft', 'O-02', $$长安工匠家庭学徒$$, $$Chang'an craft apprentice$$, $$从家族作坊开始，观察材料、工序与城市交易；具体作坊不指向已发现遗址。$$, $$合理重建$$, array['S-003','S-004','S-008'], array['C-O02-001','C-O02-002'], true),
  ('clerk', 'O-03', $$京兆基层吏员家庭成员$$, $$Jingzhao clerical household$$, $$接触文书、里坊边界与基层行政的日常压力；具体履历不冒充人物档案。$$, $$合理重建$$, array['S-002','S-006','S-008'], array['C-O03-001','C-O03-002','C-O03-003'], true)
on conflict (id) do update set
  scenario_id = excluded.scenario_id, code = excluded.code, title = excluded.title,
  english = excluded.english, detail = excluded.detail, classification = excluded.classification,
  source_ids = excluded.source_ids, claim_ids = excluded.claim_ids, published = excluded.published,
  updated_at = now();

insert into public.historical_origin_sources (origin_id, source_id)
select origin.id, source_id
from public.historical_origins origin
cross join unnest(origin.source_ids) as source_id
on conflict (origin_id, source_id) do nothing;

insert into public.historical_origin_claims (origin_id, claim_id)
select origin.id, claim_id
from public.historical_origins origin
cross join unnest(origin.claim_ids) as claim_id
on conflict (origin_id, claim_id) do nothing;
