-- ChronoKalamos phase 6: bound expensive model-turn admission and provide a
-- service-only retention hook for request rows. The trigger runs before a new
-- reservation is inserted, so duplicate clientTurnIds still replay safely.

create index if not exists game_turn_requests_owner_created_at_idx
  on public.game_turn_requests (owner_id, created_at desc);

create or replace function public.enforce_game_turn_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
begin
  -- Serialize admissions for one owner so concurrent sessions cannot bypass
  -- the window through a read-before-insert race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner_id::text, 0)
  );

  select count(*)::integer
  into v_recent
  from public.game_turn_requests
  where owner_id = new.owner_id
    and created_at >= now() - interval '1 minute';

  if v_recent >= 12 then
    raise exception using errcode = 'P0001', message = 'turn_rate_limited';
  end if;

  return new;
end;
$$;

drop trigger if exists game_turn_requests_rate_limit on public.game_turn_requests;
create trigger game_turn_requests_rate_limit
before insert on public.game_turn_requests
for each row execute function public.enforce_game_turn_rate_limit();

revoke all on function public.enforce_game_turn_rate_limit() from public, anon, authenticated;

create or replace function public.cleanup_game_turn_requests(
  p_before timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.game_turn_requests
  where created_at < p_before
    and status <> 'processing';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_game_turn_requests(timestamptz)
  from public, anon, authenticated;
grant execute on function public.cleanup_game_turn_requests(timestamptz)
  to service_role;
