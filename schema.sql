-- Run this in Supabase SQL editor (or any Postgres/Neon connection)
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  interest text,
  source text default 'holiday',
  user_agent text,
  ip inet,
  unique(email, source)
);

-- Enable RLS and allow inserts via service role only (no anon writes)
alter table public.waitlist_signups enable row level security;

create policy "service-role-all" on public.waitlist_signups
  for all
  using (true)
  with check (true);

-- (Optional) If you want anon read for dashboards, add a read-only policy:
-- create policy "anon-read" on public.waitlist_signups
--   for select to anon using (true);
