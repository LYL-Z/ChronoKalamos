-- ChronoKalamos phase 5: owner-scoped save deletion.
-- Direct table writes remain revoked. This RPC supplies the narrow deletion
-- path needed by the save screen and by repeatable live integration tests.

create or replace function public.delete_game_session(
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  delete from public.game_sessions
  where id = p_session_id
    and owner_id = v_user_id
  returning id into v_deleted_id;

  return v_deleted_id is not null;
end;
$$;

revoke all on function public.delete_game_session(uuid) from public, anon;
grant execute on function public.delete_game_session(uuid) to authenticated;
