-- Finalize the local side of a successful Stripe charge as one transaction.
-- Stripe remains the source of truth for the external charge; this function
-- only accepts the exact scheduled-payment, order, and PaymentIntent binding.
create or replace function public.finalize_scheduled_payment_charge(
  p_scheduled_payment_id uuid,
  p_order_id uuid,
  p_stripe_payment_intent_id text,
  p_charged_at timestamptz default now()
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  payment_row public.scheduled_payments%rowtype;
  order_row public.orders%rowtype;
  was_reconciled boolean := false;
begin
  if p_scheduled_payment_id is null or p_order_id is null
     or p_stripe_payment_intent_id is null
     or length(p_stripe_payment_intent_id) not between 8 and 255
     or p_charged_at is null then
    raise exception 'Invalid charge finalization parameters';
  end if;

  select * into payment_row
  from public.scheduled_payments
  where id = p_scheduled_payment_id
  for update;
  if not found then raise exception 'Scheduled payment not found'; end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  if payment_row.order_id <> order_row.id
     or payment_row.amount is null
     or payment_row.amount <> order_row.total_cents
     or payment_row.payment_method_id = 'pm_pending' then
    raise exception 'Charge finalization binding mismatch';
  end if;

  if payment_row.status = 'charged' then
    if payment_row.stripe_payment_intent_id is distinct from p_stripe_payment_intent_id then
      raise exception 'PaymentIntent binding mismatch';
    end if;
    if order_row.status = 'scheduled' then
      update public.orders set status = 'charged' where id = order_row.id;
      was_reconciled := true;
    elsif order_row.status <> 'charged' then
      raise exception 'Order is not chargeable';
    end if;
    return case when was_reconciled then 'reconciled' else 'already_charged' end;
  end if;

  if payment_row.status <> 'processing' or order_row.status <> 'scheduled' then
    raise exception 'Payment is not finalizable';
  end if;

  update public.scheduled_payments
  set status = 'charged',
      stripe_payment_intent_id = p_stripe_payment_intent_id,
      charged_at = p_charged_at,
      failed_at = null,
      processing_at = null,
      next_retry_at = null,
      failure_code = null,
      last_error = null
  where id = payment_row.id;

  update public.orders set status = 'charged' where id = order_row.id;
  return 'charged';
end;
$$;

revoke all on function public.finalize_scheduled_payment_charge(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_scheduled_payment_charge(uuid, uuid, text, timestamptz)
  to service_role;

comment on function public.finalize_scheduled_payment_charge(uuid, uuid, text, timestamptz) is
  'Atomically finalizes a Stripe-successful scheduled payment and its order.';

-- Declines are terminal too, so keep that local two-row transition atomic.
create or replace function public.finalize_scheduled_payment_failure(
  p_scheduled_payment_id uuid,
  p_order_id uuid,
  p_failure_code text,
  p_failed_at timestamptz default now()
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  payment_row public.scheduled_payments%rowtype;
  order_row public.orders%rowtype;
begin
  if p_scheduled_payment_id is null or p_order_id is null
     or p_failure_code is null or length(p_failure_code) not between 1 and 64
     or p_failed_at is null then
    raise exception 'Invalid payment failure parameters';
  end if;

  select * into payment_row from public.scheduled_payments
  where id = p_scheduled_payment_id for update;
  if not found then raise exception 'Scheduled payment not found'; end if;
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if payment_row.order_id <> order_row.id
     or payment_row.amount is null
     or payment_row.amount <> order_row.total_cents then
    raise exception 'Payment failure binding mismatch';
  end if;

  if payment_row.status = 'failed' then
    if order_row.status = 'scheduled' then
      update public.orders set status = 'failed' where id = order_row.id;
      return 'reconciled';
    elsif order_row.status = 'failed' then
      return 'already_failed';
    end if;
    raise exception 'Order failure state mismatch';
  end if;

  if payment_row.status <> 'processing' or order_row.status <> 'scheduled' then
    raise exception 'Payment is not fail-finalizable';
  end if;

  update public.scheduled_payments
  set status = 'failed', failed_at = p_failed_at,
      processing_at = null, next_retry_at = null,
      failure_code = p_failure_code, last_error = 'Payment attempt failed'
  where id = payment_row.id;
  update public.orders set status = 'failed' where id = order_row.id;
  return 'failed';
end;
$$;

revoke all on function public.finalize_scheduled_payment_failure(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_scheduled_payment_failure(uuid, uuid, text, timestamptz)
  to service_role;

-- Repair rows left by the former two-update implementation. This never calls
-- Stripe and only advances an order when its bound scheduled payment contains
-- an internally consistent terminal result.
create or replace function public.reconcile_terminal_scheduled_payment_orders(
  p_limit integer default 100
)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  reconciled_count bigint;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid reconciliation limit';
  end if;

  with candidates as (
    select o.id, sp.status
    from public.orders o
    join public.scheduled_payments sp on sp.order_id = o.id
    where o.status = 'scheduled'
      and sp.amount is not null
      and sp.amount = o.total_cents
      and (
        (sp.status = 'charged' and sp.stripe_payment_intent_id is not null
          and sp.payment_method_id <> 'pm_pending')
        or (sp.status = 'failed' and sp.failure_code is not null)
      )
    order by sp.charged_at nulls last, sp.created_at
    for update of o skip locked
    limit p_limit
  )
  update public.orders o
  set status = c.status
  from candidates c
  where o.id = c.id;

  get diagnostics reconciled_count = row_count;
  return reconciled_count;
end;
$$;

revoke all on function public.reconcile_terminal_scheduled_payment_orders(integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_terminal_scheduled_payment_orders(integer)
  to service_role;

comment on function public.reconcile_terminal_scheduled_payment_orders(integer) is
  'Repairs legacy terminal-payment/scheduled-order split states without contacting Stripe.';
