create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.scheduled_payments from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.scheduled_payments to authenticated;

drop policy if exists "profile_owner_select" on public.profiles;
create policy "profile_owner_select"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profile_owner_insert" on public.profiles;
create policy "profile_owner_insert"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profile_owner_update" on public.profiles;
create policy "profile_owner_update"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "orders_owner_select" on public.orders;
create policy "orders_owner_select"
on public.orders for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "scheduled_payments_owner_select" on public.scheduled_payments;
create policy "scheduled_payments_owner_select"
on public.scheduled_payments for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = scheduled_payments.order_id
      and o.user_id = (select auth.uid())
  )
);
