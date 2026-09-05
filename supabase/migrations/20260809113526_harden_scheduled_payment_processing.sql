alter table public.scheduled_payments
  add column if not exists processing_at timestamptz;

create index if not exists scheduled_payments_due_idx
  on public.scheduled_payments (status, run_at_date)
  where status = 'scheduled';

alter table public.scheduled_payments
  drop constraint if exists scheduled_payments_amount_positive;
alter table public.scheduled_payments
  add constraint scheduled_payments_amount_positive check (amount > 0);

alter table public.scheduled_payments
  drop constraint if exists scheduled_payments_status_valid;
alter table public.scheduled_payments
  add constraint scheduled_payments_status_valid
  check (status in ('scheduled','processing','charged','failed','cancelled'));

alter table public.scheduled_payments
  drop constraint if exists scheduled_payments_currency_valid;
alter table public.scheduled_payments
  add constraint scheduled_payments_currency_valid
  check (currency ~ '^[a-z]{3}$');
