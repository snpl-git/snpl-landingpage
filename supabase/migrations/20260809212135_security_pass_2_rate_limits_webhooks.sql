-- Security Pass #2: shared API velocity state and durable Stripe event replay protection.

create table public.api_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.api_rate_limits%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  if length(p_key_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.api_rate_limits(key_hash, window_started_at, request_count, expires_at)
  values (p_key_hash, now_at, 1, now_at + make_interval(secs => p_window_seconds))
  on conflict (key_hash) do update
    set request_count = case
          when public.api_rate_limits.expires_at <= now_at then 1
          else public.api_rate_limits.request_count + 1
        end,
        window_started_at = case
          when public.api_rate_limits.expires_at <= now_at then now_at
          else public.api_rate_limits.window_started_at
        end,
        expires_at = case
          when public.api_rate_limits.expires_at <= now_at
            then now_at + make_interval(secs => p_window_seconds)
          else public.api_rate_limits.expires_at
        end
  returning * into current_row;

  return query select
    current_row.request_count <= p_limit,
    greatest(p_limit - current_row.request_count, 0),
    case when current_row.request_count <= p_limit then 0
      else greatest(1, ceil(extract(epoch from current_row.expires_at - now_at))::integer)
    end;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

create index api_rate_limits_expires_at_idx on public.api_rate_limits(expires_at);

create table public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  received_at timestamptz not null default now(),
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz,
  result_code text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  constraint stripe_webhook_event_id_length check (length(stripe_event_id) between 8 and 255),
  constraint stripe_webhook_event_type_length check (length(event_type) between 1 and 255),
  constraint stripe_webhook_result_code_length check (result_code is null or length(result_code) <= 64)
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant select, insert, update, delete on public.stripe_webhook_events to service_role;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_stale_after interval default interval '5 minutes'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare existing public.stripe_webhook_events%rowtype;
declare inserted_count integer;
begin
  insert into public.stripe_webhook_events(stripe_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then return 'claimed'; end if;

  select * into existing from public.stripe_webhook_events
  where stripe_event_id = p_event_id for update;

  if existing.event_type <> p_event_type then return 'conflict'; end if;
  if existing.status = 'processed' then return 'duplicate'; end if;
  if existing.status = 'processing'
     and existing.processing_started_at >= now() - p_stale_after then return 'busy'; end if;

  update public.stripe_webhook_events
  set status = 'processing', processing_started_at = now(),
      attempt_count = attempt_count + 1, result_code = null
  where stripe_event_id = p_event_id;
  return 'claimed';
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, interval) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, interval) to service_role;

create or replace function public.cleanup_expired_security_state()
returns table (rate_limits_deleted bigint, webhook_events_deleted bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare rate_count bigint;
declare event_count bigint;
begin
  delete from public.api_rate_limits where expires_at < now() - interval '24 hours';
  get diagnostics rate_count = row_count;
  delete from public.stripe_webhook_events
    where received_at < now() - interval '90 days' and status in ('processed', 'failed');
  get diagnostics event_count = row_count;
  return query select rate_count, event_count;
end;
$$;

revoke all on function public.cleanup_expired_security_state() from public, anon, authenticated;
grant execute on function public.cleanup_expired_security_state() to service_role;
