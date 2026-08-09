-- Persist durable checkout idempotency state and the exact Stripe SetupIntent.
-- These nullable additions preserve existing orders and do not alter RLS policies,
-- account ownership columns, grants, or scheduled-payment protections.
alter table public.orders
  add column if not exists checkout_request_id uuid,
  add column if not exists checkout_request_fingerprint text,
  add column if not exists stripe_setup_intent_id text;

create unique index if not exists orders_checkout_request_id_key
  on public.orders (checkout_request_id)
  where checkout_request_id is not null;

create unique index if not exists orders_stripe_setup_intent_id_key
  on public.orders (stripe_setup_intent_id)
  where stripe_setup_intent_id is not null;

comment on column public.orders.checkout_request_id is
  'Client-generated UUID used to make checkout creation idempotent.';
comment on column public.orders.checkout_request_fingerprint is
  'SHA-256 fingerprint of the validated checkout payload.';
comment on column public.orders.stripe_setup_intent_id is
  'Exact Stripe SetupIntent associated with this SNPL order.';
