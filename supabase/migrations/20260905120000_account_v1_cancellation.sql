-- Account v1: additive owner-query indexes and atomic, server-only cancellation.
create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc)
  where user_id is not null;

create index if not exists scheduled_payments_order_status_idx
  on public.scheduled_payments (order_id, status);

create or replace function public.cancel_owned_scheduled_purchase(
  p_scheduled_payment_id uuid,
  p_user_id uuid
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
  if p_user_id is null then
    raise exception 'User identity is required';
  end if;

  select sp.* into payment_row
  from public.scheduled_payments sp
  where sp.id = p_scheduled_payment_id
  for update;

  if not found then return 'not_found'; end if;

  select o.* into order_row
  from public.orders o
  where o.id = payment_row.order_id
    and o.user_id = p_user_id
  for update;

  if not found then return 'not_found'; end if;
  if payment_row.status = 'cancelled' and order_row.status = 'cancelled' then return 'already_cancelled'; end if;
  if payment_row.status <> 'scheduled' or payment_row.processing_at is not null or order_row.status <> 'scheduled' then
    return 'state_conflict';
  end if;

  update public.scheduled_payments
  set status = 'cancelled'
  where id = payment_row.id
    and status = 'scheduled'
    and processing_at is null;
  if not found then return 'state_conflict'; end if;

  update public.orders
  set status = 'cancelled'
  where id = order_row.id and user_id = p_user_id and status = 'scheduled';
  if not found then raise exception 'Order cancellation conflict'; end if;

  return 'cancelled';
end;
$$;

revoke all on function public.cancel_owned_scheduled_purchase(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_owned_scheduled_purchase(uuid, uuid)
  to service_role;

comment on function public.cancel_owned_scheduled_purchase(uuid, uuid) is
  'Atomically cancels an owned, unclaimed scheduled purchase. Server service role only.';
