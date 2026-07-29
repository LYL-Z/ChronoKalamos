-- Count actual provider admissions, not requests rejected by phone/IP/daily
-- guardrails. Otherwise rejected traffic could exhaust the Twilio budget
-- without making any external provider call.

create or replace function public.reserve_phone_auth_send(
  p_request_id uuid,
  p_phone_hash text,
  p_phone_masked text,
  p_ip_hash text,
  p_provider text,
  p_phone_window_seconds integer default 60,
  p_ip_daily_limit integer default 10,
  p_daily_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.phone_auth_audit%rowtype;
  v_phone_count integer;
  v_ip_count integer;
  v_daily_count integer;
  v_reason text;
begin
  if p_request_id is null
    or nullif(trim(p_phone_hash), '') is null
    or nullif(trim(p_phone_masked), '') is null
    or nullif(trim(p_ip_hash), '') is null
    or p_provider not in ('mock', 'twilio') then
    raise exception using errcode = '22023', message = 'phone_auth_reservation_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chrono-phone:' || p_phone_hash, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chrono-ip:' || p_ip_hash || ':' || current_date::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chrono-daily:' || current_date::text, 0)
  );

  select *
    into v_existing
    from public.phone_auth_audit
   where request_id = p_request_id
   for update;

  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'result_code', v_existing.result_code,
      'provider_status', v_existing.provider_status,
      'request_id', v_existing.request_id
    );
  end if;

  select count(*)::integer
    into v_phone_count
    from public.phone_auth_audit
   where operation = 'send'
     and phone_hash = p_phone_hash
     and created_at >= now() - make_interval(secs => greatest(p_phone_window_seconds, 1));

  select count(*)::integer
    into v_ip_count
    from public.phone_auth_audit
   where operation = 'send'
     and ip_hash = p_ip_hash
     and created_at >= date_trunc('day', now());

  select count(*)::integer
    into v_daily_count
    from public.phone_auth_audit
   where operation = 'send'
     and provider = 'twilio'
     and result_code not in ('phone_cooldown', 'ip_daily_limit', 'daily_limit')
     and created_at >= date_trunc('day', now());

  if v_phone_count >= 1 then
    v_reason := 'phone_cooldown';
  elsif v_ip_count >= greatest(p_ip_daily_limit, 1) then
    v_reason := 'ip_daily_limit';
  elsif v_daily_count >= greatest(p_daily_limit, 1) then
    v_reason := 'daily_limit';
  else
    v_reason := 'reserved';
  end if;

  insert into public.phone_auth_audit (
    request_id, operation, phone_hash, phone_masked, ip_hash, provider, result_code, created_at
  ) values (
    p_request_id, 'send', p_phone_hash, p_phone_masked, p_ip_hash, p_provider, v_reason, now()
  );

  return jsonb_build_object(
    'status', v_reason,
    'phone_count', v_phone_count,
    'ip_count', v_ip_count,
    'daily_count', v_daily_count,
    'request_id', p_request_id
  );
end;
$$;
