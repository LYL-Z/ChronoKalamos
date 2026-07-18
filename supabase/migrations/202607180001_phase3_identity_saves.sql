-- ChronoKalamos phase 3: identity, saves, checkpoints, and private uploads.
-- Run this migration with the Supabase migration runner. Do not expose a
-- service-role key to the browser; every client operation is constrained here.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'zh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_locale_check check (locale in ('zh', 'en', 'fr', 'el', 'ru'))
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_session_id uuid not null,
  scenario_id text not null default 'tang-changan-742',
  title text not null,
  character_profile jsonb not null default '{}'::jsonb,
  world_state jsonb not null default jsonb_build_object(
    'time', '742-01-01',
    'location', 'changan',
    'health', jsonb_build_object('condition', 'stable'),
    'socialIdentity', null,
    'occupation', null,
    'money', jsonb_build_object(),
    'items', jsonb_build_array(),
    'relationships', jsonb_build_array(),
    'reputation', jsonb_build_object(),
    'skills', jsonb_build_object(),
    'quests', jsonb_build_array(),
    'risks', jsonb_build_array(),
    'death', null
  ),
  status text not null default 'draft',
  state_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_sessions_status_check check (status in ('draft', 'active', 'ended', 'archived')),
  constraint game_sessions_state_version_check check (state_version >= 0),
  constraint game_sessions_owner_client_key unique (owner_id, client_session_id),
  constraint game_sessions_id_owner_key unique (id, owner_id)
);

create table if not exists public.game_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_turn_id uuid not null,
  turn_number integer not null,
  input jsonb not null default '{}'::jsonb,
  narrative jsonb not null default '{}'::jsonb,
  state_before jsonb not null default '{}'::jsonb,
  state_after jsonb not null default '{}'::jsonb,
  committed_state_version integer not null,
  created_at timestamptz not null default now(),
  constraint game_turns_session_owner_fk
    foreign key (session_id, owner_id)
    references public.game_sessions (id, owner_id)
    on delete cascade,
  constraint game_turns_turn_number_check check (turn_number >= 0),
  constraint game_turns_state_version_check check (committed_state_version >= 0),
  constraint game_turns_owner_client_key unique (owner_id, client_turn_id),
  constraint game_turns_session_number_key unique (session_id, turn_number)
);

create table if not exists public.game_checkpoints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  state_version integer not null,
  world_state jsonb not null,
  reason text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint game_checkpoints_session_owner_fk
    foreign key (session_id, owner_id)
    references public.game_sessions (id, owner_id)
    on delete cascade,
  constraint game_checkpoints_state_version_check check (state_version >= 0),
  constraint game_checkpoints_reason_check check (reason in ('initial', 'turn', 'manual', 'ending')),
  constraint game_checkpoints_session_version_key unique (session_id, state_version)
);

create table if not exists public.user_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  bucket_id text not null default 'user-uploads',
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint user_uploads_path_key unique (storage_path),
  constraint user_uploads_bucket_check check (bucket_id = 'user-uploads'),
  constraint user_uploads_path_owner_check check (storage_path like (owner_id::text || '/%')),
  constraint user_uploads_mime_check check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint user_uploads_size_check check (size_bytes > 0 and size_bytes <= 5242880),
  constraint user_uploads_status_check check (status in ('ready', 'deleted'))
);

alter table public.profiles enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_turns enable row level security;
alter table public.game_checkpoints enable row level security;
alter table public.user_uploads enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "game_sessions_select_own" on public.game_sessions;
create policy "game_sessions_select_own" on public.game_sessions
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "game_sessions_insert_own" on public.game_sessions;
create policy "game_sessions_insert_own" on public.game_sessions
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "game_sessions_update_own" on public.game_sessions;
create policy "game_sessions_update_own" on public.game_sessions
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "game_sessions_delete_own" on public.game_sessions;
create policy "game_sessions_delete_own" on public.game_sessions
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "game_turns_select_own" on public.game_turns;
create policy "game_turns_select_own" on public.game_turns
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "game_turns_insert_own" on public.game_turns;
create policy "game_turns_insert_own" on public.game_turns
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "game_turns_update_own" on public.game_turns;
create policy "game_turns_update_own" on public.game_turns
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "game_turns_delete_own" on public.game_turns;
create policy "game_turns_delete_own" on public.game_turns
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "game_checkpoints_select_own" on public.game_checkpoints;
create policy "game_checkpoints_select_own" on public.game_checkpoints
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "game_checkpoints_insert_own" on public.game_checkpoints;
create policy "game_checkpoints_insert_own" on public.game_checkpoints
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "game_checkpoints_update_own" on public.game_checkpoints;
create policy "game_checkpoints_update_own" on public.game_checkpoints
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "game_checkpoints_delete_own" on public.game_checkpoints;
create policy "game_checkpoints_delete_own" on public.game_checkpoints
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "user_uploads_select_own" on public.user_uploads;
create policy "user_uploads_select_own" on public.user_uploads
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "user_uploads_insert_own" on public.user_uploads;
create policy "user_uploads_insert_own" on public.user_uploads
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "user_uploads_update_own" on public.user_uploads;
create policy "user_uploads_update_own" on public.user_uploads
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "user_uploads_delete_own" on public.user_uploads;
create policy "user_uploads_delete_own" on public.user_uploads
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'user-uploads',
  'user-uploads',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_user_uploads_select_own" on storage.objects;
create policy "storage_user_uploads_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and owner_id = (select auth.uid()::text)
  );

drop policy if exists "storage_user_uploads_insert_own" on storage.objects;
create policy "storage_user_uploads_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and owner_id = (select auth.uid()::text)
  );

drop policy if exists "storage_user_uploads_delete_own" on storage.objects;
create policy "storage_user_uploads_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'user-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and owner_id = (select auth.uid()::text)
  );
