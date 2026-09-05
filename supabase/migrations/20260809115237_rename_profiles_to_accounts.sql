alter table if exists public.profiles rename to accounts;

alter policy if exists profile_owner_select on public.accounts rename to account_owner_select;
alter policy if exists profile_owner_insert on public.accounts rename to account_owner_insert;
alter policy if exists profile_owner_update on public.accounts rename to account_owner_update;
