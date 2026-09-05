create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create index if not exists orders_user_id_idx on public.orders(user_id);

do $$
begin
  if exists (select 1 from cron.job where jobname = 'snpl-keep-alive') then
    perform cron.unschedule('snpl-keep-alive');
  end if;
end
$$;

select cron.schedule(
  'snpl-keep-alive',
  '0 */6 * * *',
  $job$
    select net.http_get(
      url := 'https://dwwmfugcutkpyezwpbfb.supabase.co/rest/v1/products?select=id&limit=1',
      headers := jsonb_build_object('apikey', 'sb_publishable_mEnVq-nKnxZLnlfDZcrDWg_j_75mG4L'),
      timeout_milliseconds := 5000
    ) as request_id;
  $job$
);
