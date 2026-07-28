-- Phase 7: server-only phone-auth admission, cost circuit breaker, and audit.
-- Phone numbers and IP addresses are represented by application-side hashes plus
-- a display mask. The database never stores the raw identifiers.

create table if not exists public.phone_auth_audit (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  operation text not null check (operation in ('send', 'check')),
  phone_hash text not null,
  phone_masked text not null,
  ip_hash text not null,
  provider text not null check (provider in ('mock', 'twilio')),
  result_code text not null,
  provider_status text,
  provider_request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists phone_auth_audit_phone_created_idx
  on public.phone_auth_audit (phone_hash, created_at desc);

create index if not exists phone_auth_audit_ip_created_idx
  on public.phone_auth_audit (ip_hash, created_at desc);

create index if not exists phone_auth_audit_created_idx
  on public.phone_auth_audit (created_at desc);

alter table public.phone_auth_audit enable row level security;
revoke all on public.phone_auth_audit from public, anon, authenticated;
grant select, insert, update on public.phone_auth_audit to service_role;

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

  -- Serialize only the short admission transaction. The external Twilio call
  -- happens after this function returns and never holds a database lock.
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

create or replace function public.complete_phone_auth_send(
  p_request_id uuid,
  p_result_code text,
  p_provider_status text default null,
  p_provider_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.phone_auth_audit
     set result_code = coalesce(nullif(trim(p_result_code), ''), 'provider_failed'),
         provider_status = p_provider_status,
         provider_request_id = p_provider_request_id,
         metadata = coalesce(p_metadata, '{}'::jsonb),
         completed_at = now()
   where request_id = p_request_id
     and operation = 'send'
     and completed_at is null
     and result_code = 'reserved';
  return found;
end;
$$;

create or replace function public.record_phone_auth_audit(
  p_request_id uuid,
  p_operation text,
  p_phone_hash text,
  p_phone_masked text,
  p_ip_hash text,
  p_provider text,
  p_result_code text,
  p_provider_status text default null,
  p_provider_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.phone_auth_audit (
    request_id, operation, phone_hash, phone_masked, ip_hash, provider,
    result_code, provider_status, provider_request_id, metadata, completed_at
  ) values (
    p_request_id, p_operation, p_phone_hash, p_phone_masked, p_ip_hash, p_provider,
    p_result_code, p_provider_status, p_provider_request_id, coalesce(p_metadata, '{}'::jsonb), now()
  )
  on conflict (request_id) do update
    set result_code = excluded.result_code,
        provider_status = excluded.provider_status,
        provider_request_id = excluded.provider_request_id,
        metadata = excluded.metadata,
        completed_at = excluded.completed_at
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.reserve_phone_auth_send(uuid, text, text, text, text, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_phone_auth_send(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_phone_auth_audit(uuid, text, text, text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.reserve_phone_auth_send(uuid, text, text, text, text, integer, integer, integer)
  to service_role;
grant execute on function public.complete_phone_auth_send(uuid, text, text, text, jsonb)
  to service_role;
grant execute on function public.record_phone_auth_audit(uuid, text, text, text, text, text, text, text, text, jsonb)
  to service_role;
