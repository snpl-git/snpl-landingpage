-- Security Pass #2: enforce one payment schedule per order and provide the
-- durable state needed for crash-safe scheduled-payment execution.

do $$
begin
  if exists (
    select 1 from public.scheduled_payments
    where order_id is not null
    group by order_id having count(*) > 1
  ) then
    raise exception 'Cannot enforce schedule uniqueness: duplicate order_id values exist';
  end if;
end
$$;

create unique index scheduled_payments_order_id_key
  on public.scheduled_payments (order_id)
  where order_id is not null;

alter table public.orders
  add column checkout_session_version integer not null default 1,
  add constraint orders_checkout_session_version_positive
    check (checkout_session_version > 0),
  add constraint orders_checkout_integrity_all_or_none check (
    (checkout_request_id is null and checkout_request_fingerprint is null and stripe_setup_intent_id is null)
    or
    (checkout_request_id is not null and checkout_request_fingerprint is not null and stripe_setup_intent_id is not null)
  ),
  add constraint orders_status_valid check (status in ('scheduled', 'charged', 'failed', 'cancelled'));

alter table public.orders
  alter column stripe_customer_id set not null,
  alter column total_cents set not null,
  alter column status set not null;

alter table public.scheduled_payments
  add column attempt_count integer not null default 0,
  add column last_attempt_at timestamptz,
  add column next_retry_at timestamptz,
  add column failure_code text,
  add constraint scheduled_payments_attempt_count_nonnegative check (attempt_count >= 0),
  add constraint scheduled_payments_failure_code_length
    check (failure_code is null or length(failure_code) <= 64);

-- These columns are populated on every known valid lifecycle path. The live
-- preflight found no null values, so they can safely become database invariants.
alter table public.scheduled_payments
  alter column order_id set not null,
  alter column run_at_date set not null,
  alter column status set not null,
  alter column currency set not null,
  alter column payment_method_id set not null;

-- amount remains nullable temporarily because the preflight found one legacy
-- row without an amount. Phase B does not guess, delete, or mutate that row.
alter table public.scheduled_payments
  add constraint scheduled_payments_new_rows_require_amount
  check (amount is not null and amount > 0) not valid;

create or replace function public.claim_due_scheduled_payments(
  p_limit integer default 25,
  p_stale_after interval default interval '15 minutes'
)
returns table (
  id uuid,
  order_id uuid,
  amount integer,
  currency text,
  payment_method_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  order_status text,
  order_total_cents integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select sp.id
    from public.scheduled_payments sp
    where (
      sp.status = 'scheduled'
      and sp.run_at_date <= (now() at time zone 'utc')::date
      and (sp.next_retry_at is null or sp.next_retry_at <= now())
    ) or (
      sp.status = 'processing'
      and sp.processing_at < now() - p_stale_after
    )
    order by sp.run_at_date, sp.created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  ), claimed as (
    update public.scheduled_payments sp
    set status = 'processing',
        processing_at = now(),
        last_attempt_at = now(),
        attempt_count = sp.attempt_count + 1,
        last_error = null,
        failure_code = null
    from candidates c
    where sp.id = c.id
    returning sp.*
  )
  select c.id, c.order_id, c.amount, c.currency, c.payment_method_id,
         c.stripe_payment_intent_id, o.stripe_customer_id,
         o.status as order_status, o.total_cents as order_total_cents
  from claimed c
  join public.orders o on o.id = c.order_id;
$$;

revoke all on function public.claim_due_scheduled_payments(integer, interval) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_payments(integer, interval) to service_role;

comment on function public.claim_due_scheduled_payments(integer, interval) is
  'Atomically claims due or stale scheduled payments for the trusted charge worker.';
