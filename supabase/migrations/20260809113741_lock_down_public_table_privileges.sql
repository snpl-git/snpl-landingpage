drop policy if exists "service-role-all" on public.waitlist_signups;

revoke all privileges on table public.waitlist_signups from anon, authenticated;
revoke all privileges on table public.orders from anon, authenticated;
revoke all privileges on table public.scheduled_payments from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
