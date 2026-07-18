-- Phase 3 hardening: keep trigger helpers outside the exposed API schema,
-- grant only the operations used by the browser client, and index RLS/FK paths.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

drop function if exists public.handle_new_user();

revoke all on table
  public.profiles,
  public.game_sessions,
  public.game_turns,
  public.game_checkpoints,
  public.user_uploads
from anon;

revoke all on table
  public.profiles,
  public.game_sessions,
  public.game_turns,
  public.game_checkpoints,
  public.user_uploads
from authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table
  public.game_sessions,
  public.game_turns,
  public.game_checkpoints,
  public.user_uploads
to authenticated;

create index if not exists game_checkpoints_owner_id_idx
  on public.game_checkpoints (owner_id);
create index if not exists game_checkpoints_session_owner_idx
  on public.game_checkpoints (session_id, owner_id);
create index if not exists game_turns_session_owner_idx
  on public.game_turns (session_id, owner_id);
create index if not exists user_uploads_owner_id_idx
  on public.user_uploads (owner_id);
