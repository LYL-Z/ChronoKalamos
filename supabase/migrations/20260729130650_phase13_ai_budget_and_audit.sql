-- ChronoKalamos phase 13: fail-closed AI admission, privacy-safe usage audit,
-- and bounded retention. No prompt, narrative, email, phone, IP address, access
-- token, provider response body, or provider credential is stored here.

create table if not exists public.ai_call_audit (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_turn_id uuid not null,
  attempt smallint not null check (attempt between 1 and 2),
  provider text not null default 'deepseek-chat'
    check (provider = 'deepseek-chat'),
  result_code text not null default 'reserved'
    check (
      result_code in (
        'reserved',
        'success',
        'model_failed',
        'model_timeout',
        'model_refusal',
        'image_not_supported',
        'validation_failed',
        'unexpected_failure',
        'abandoned'
      )
    ),
  latency_ms integer check (latency_ms is null or latency_ms between 0 and 300000),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (owner_id, client_turn_id, attempt)
);

alter table public.ai_call_audit enable row level security;

revoke all on table public.ai_call_audit from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_call_audit to service_role;

drop policy if exists ai_call_audit_deny_client_access
  on public.ai_call_audit;
create policy ai_call_audit_deny_client_access
  on public.ai_call_audit
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create index if not exists ai_call_audit_owner_created_at_idx
  on public.ai_call_audit (owner_id, created_at desc);

create index if not exists ai_call_audit_created_at_idx
  on public.ai_call_audit (created_at desc);

create or replace function public.reserve_ai_call(
  p_owner_id uuid,
  p_client_turn_id uuid,
  p_attempt smallint,
  p_user_daily_limit integer,
  p_global_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_user_count integer;
  v_global_count integer;
begin
  if p_owner_id is null
    or p_client_turn_id is null
    or p_attempt is null
    or p_attempt not between 1 and 2
    or p_user_daily_limit is null
    or p_user_daily_limit not between 1 and 1000
    or p_global_daily_limit is null
    or p_global_daily_limit not between 1 and 100000
    or p_user_daily_limit > p_global_daily_limit then
    raise exception using errcode = '22023', message = 'invalid_ai_budget_arguments';
  end if;

  -- Every caller acquires the global lock before the owner lock. This fixed
  -- order prevents deadlocks and makes the two quota counts race-free.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('chronokalamos-ai-global:' || v_day_start::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'chronokalamos-ai-owner:' || p_owner_id::text || ':' || v_day_start::text,
      0
    )
  );

  if exists (
    select 1
    from public.ai_call_audit
    where owner_id = p_owner_id
      and client_turn_id = p_client_turn_id
      and attempt = p_attempt
  ) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select count(*)::integer
  into v_global_count
  from public.ai_call_audit
  where created_at >= v_day_start
    and created_at < v_day_start + interval '1 day';

  if v_global_count >= p_global_daily_limit then
    return jsonb_build_object(
      'status', 'global_daily_limit',
      'globalDailyCount', v_global_count
    );
  end if;

  select count(*)::integer
  into v_user_count
  from public.ai_call_audit
  where owner_id = p_owner_id
    and created_at >= v_day_start
    and created_at < v_day_start + interval '1 day';

  if v_user_count >= p_user_daily_limit then
    return jsonb_build_object(
      'status', 'user_daily_limit',
      'userDailyCount', v_user_count,
      'globalDailyCount', v_global_count
    );
  end if;

  insert into public.ai_call_audit (
    owner_id,
    client_turn_id,
    attempt
  )
  values (
    p_owner_id,
    p_client_turn_id,
    p_attempt
  );

  return jsonb_build_object(
    'status', 'reserved',
    'userDailyCount', v_user_count + 1,
    'globalDailyCount', v_global_count + 1
  );
end;
$$;

revoke all on function public.reserve_ai_call(
  uuid,
  uuid,
  smallint,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.reserve_ai_call(
  uuid,
  uuid,
  smallint,
  integer,
  integer
) to service_role;

create or replace function public.complete_ai_call(
  p_owner_id uuid,
  p_client_turn_id uuid,
  p_attempt smallint,
  p_result_code text,
  p_latency_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_result_code is null or p_result_code not in (
    'success',
    'model_failed',
    'model_timeout',
    'model_refusal',
    'image_not_supported',
    'validation_failed',
    'unexpected_failure'
  ) or p_latency_ms is null or p_latency_ms not between 0 and 300000 then
    raise exception using errcode = '22023', message = 'invalid_ai_audit_completion';
  end if;

  update public.ai_call_audit
  set result_code = p_result_code,
      latency_ms = p_latency_ms,
      completed_at = now()
  where owner_id = p_owner_id
    and client_turn_id = p_client_turn_id
    and attempt = p_attempt
    and result_code = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.complete_ai_call(
  uuid,
  uuid,
  smallint,
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.complete_ai_call(
  uuid,
  uuid,
  smallint,
  text,
  integer
) to service_role;

create or replace function public.cleanup_ai_call_audit(
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
  if p_before is null or p_before > now() - interval '7 days' then
    raise exception using errcode = '22023', message = 'ai_audit_retention_too_short';
  end if;

  update public.ai_call_audit
  set result_code = 'abandoned',
      completed_at = now()
  where result_code = 'reserved'
    and created_at < now() - interval '1 hour';

  delete from public.ai_call_audit
  where created_at < p_before;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_ai_call_audit(timestamptz)
  from public, anon, authenticated;
grant execute on function public.cleanup_ai_call_audit(timestamptz)
  to service_role;
