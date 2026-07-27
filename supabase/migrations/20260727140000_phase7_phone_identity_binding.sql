-- Phase 7: bind a Twilio-verified CN phone as a secondary Supabase identity.
-- Email remains the primary recovery credential. This function does not issue
-- a Supabase session and it never merges two users.

create or replace function public.prepare_verified_phone_binding(
  p_user_id uuid,
  p_phone text,
  p_stale_after_minutes integer default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_phone text;
  v_conflicting_user uuid;
  v_cleared_stale integer := 0;
begin
  if p_user_id is null then
    return jsonb_build_object('status', 'user_not_found');
  end if;

  if p_phone is null or p_phone !~ '^\+86(1[3-9][0-9]{9})$' then
    return jsonb_build_object('status', 'invalid_phone');
  end if;

  if p_stale_after_minutes < 60 then
    return jsonb_build_object('status', 'invalid_stale_window');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('phone-binding:' || p_phone, 0));

  select u.phone
    into v_current_phone
    from auth.users as u
   where u.id = p_user_id
   for update;

  if not found then
    return jsonb_build_object('status', 'user_not_found');
  end if;

  if nullif(v_current_phone, '') = p_phone then
    return jsonb_build_object('status', 'already_bound');
  end if;

  if nullif(v_current_phone, '') is not null then
    return jsonb_build_object('status', 'phone_replacement_requires_reauth');
  end if;

  select u.id
    into v_conflicting_user
    from auth.users as u
   where u.id <> p_user_id
     and nullif(u.phone, '') = p_phone
   limit 1;

  if v_conflicting_user is not null then
    return jsonb_build_object('status', 'phone_already_bound');
  end if;

  select u.id
    into v_conflicting_user
    from auth.users as u
   where u.id <> p_user_id
     and nullif(u.phone_change, '') = p_phone
     and (
       u.phone_change_sent_at is null
       or u.phone_change_sent_at > now() - make_interval(mins => p_stale_after_minutes)
     )
   limit 1;

  if v_conflicting_user is not null then
    return jsonb_build_object('status', 'phone_change_in_progress');
  end if;

  update auth.users as u
     set phone_change = '',
         phone_change_token = '',
         phone_change_sent_at = null,
         updated_at = now()
   where u.id <> p_user_id
     and nullif(u.phone_change, '') = p_phone
     and u.phone_change_sent_at is not null
     and u.phone_change_sent_at <= now() - make_interval(mins => p_stale_after_minutes);

  get diagnostics v_cleared_stale = row_count;

  return jsonb_build_object(
    'status', 'ready',
    'cleared_stale_phone_changes', v_cleared_stale
  );
end;
$$;

revoke all on function public.prepare_verified_phone_binding(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.prepare_verified_phone_binding(uuid, text, integer)
  to service_role;

comment on function public.prepare_verified_phone_binding(uuid, text, integer) is
  'Service-role-only preflight for initial phone binding. It blocks account merge and phone replacement, and clears abandoned phone_change reservations after the configured grace period.';
