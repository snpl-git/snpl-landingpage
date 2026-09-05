import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

async function securityDatabase() {
  const db = new PGlite()
  await db.exec(`
    create role anon noinherit;
    create role authenticated noinherit;
    create role service_role noinherit bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.orders(
      id uuid primary key default gen_random_uuid(), stripe_customer_id text, status text,
      total_cents integer, user_id uuid, checkout_request_id uuid,
      checkout_request_fingerprint text, stripe_setup_intent_id text,
      created_at timestamptz not null default now()
    );
    create table public.scheduled_payments(
      id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id),
      amount integer, run_at_date date, status text, created_at timestamptz default now(),
      currency text, payment_method_id text, stripe_payment_intent_id text,
      charged_at timestamptz, failed_at timestamptz, last_error text, processing_at timestamptz
    );
    create unique index orders_checkout_request_id_key on public.orders(checkout_request_id) where checkout_request_id is not null;
    create unique index orders_stripe_setup_intent_id_key on public.orders(stripe_setup_intent_id) where stripe_setup_intent_id is not null;
  `)
  for (const migration of [
    'supabase/migrations/20260809114931_account_foundation_and_owner_rls.sql',
    'supabase/migrations/20260809115237_rename_profiles_to_accounts.sql',
    'supabase/migrations/20260809211921_security_pass_2_payment_integrity.sql',
    'supabase/migrations/20260809212135_security_pass_2_rate_limits_webhooks.sql',
    'supabase/migrations/20260809212158_atomic_payment_charge_finalization.sql',
    'supabase/migrations/20260905120000_account_v1_cancellation.sql',
  ]) await db.exec(await readFile(migration, 'utf8'))
  return db
}

test('account RLS policies bind account and order reads to auth.uid()', async () => {
  const db = await securityDatabase()
  const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  await db.query('insert into auth.users(id) values ($1),($2)', [userA, userB])
  await db.query(`insert into accounts(id,display_name) values ($1,'A'),($2,'B')`, [userA, userB])
  await db.query(`insert into orders(id,user_id,stripe_customer_id,status,total_cents) values
    ('11111111-1111-4111-8111-111111111111',$1,'cus_a','scheduled',1000),
    ('22222222-2222-4222-8222-222222222222',$2,'cus_b','scheduled',2000)`, [userA, userB])
  const policies = await db.query(`select tablename,qual from pg_policies
    where policyname in ('account_owner_select','orders_owner_select') order by tablename`)
  assert.equal(policies.rows.length, 2)
  const accountPolicy = policies.rows.find((row) => row.tablename === 'accounts')
  const orderPolicy = policies.rows.find((row) => row.tablename === 'orders')
  assert.match(accountPolicy.qual, /auth\.uid\(\).*id|id.*auth\.uid\(\)/)
  assert.match(orderPolicy.qual, /auth\.uid\(\).*user_id|user_id.*auth\.uid\(\)/)
  const visibleToA = await db.query('select user_id from orders where user_id=$1', [userA])
  assert.deepEqual(visibleToA.rows.map((row) => row.user_id), [userA])
  await db.close()
})

test('cancellation is owner-only and only allowed before processing', async () => {
  const db = await securityDatabase()
  const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const orderId = '33333333-3333-4333-8333-333333333333'
  const paymentId = '44444444-4444-4444-8444-444444444444'
  await db.query('insert into auth.users(id) values ($1),($2)', [userA, userB])
  await db.query(`insert into orders(id,user_id,stripe_customer_id,status,total_cents) values ($1,$2,'cus_a','scheduled',1000)`, [orderId, userA])
  await db.query(`insert into scheduled_payments(id,order_id,amount,run_at_date,status,currency,payment_method_id) values ($1,$2,1000,current_date,'scheduled','usd','pm_a')`, [paymentId, orderId])
  const denied = await db.query('select cancel_owned_scheduled_purchase($1,$2) result', [paymentId, userB])
  assert.equal(denied.rows[0].result, 'not_found')
  await db.query(`update scheduled_payments set status='processing',processing_at=now() where id=$1`, [paymentId])
  const processing = await db.query('select cancel_owned_scheduled_purchase($1,$2) result', [paymentId, userA])
  assert.equal(processing.rows[0].result, 'state_conflict')
  await db.query(`update scheduled_payments set status='scheduled',processing_at=null where id=$1`, [paymentId])
  const cancelled = await db.query('select cancel_owned_scheduled_purchase($1,$2) result', [paymentId, userA])
  assert.equal(cancelled.rows[0].result, 'cancelled')
  const state = await db.query(`select sp.status payment_status,o.status order_status from scheduled_payments sp join orders o on o.id=sp.order_id where sp.id=$1`, [paymentId])
  assert.deepEqual(state.rows[0], { payment_status: 'cancelled', order_status: 'cancelled' })
  await db.close()
})

test('database blocks duplicate schedules and anonymous security-state access', async () => {
  const db = await securityDatabase()
  const order = '11111111-1111-4111-8111-111111111111'
  await db.query(`insert into orders(id,stripe_customer_id,status,total_cents,checkout_request_id,checkout_request_fingerprint,stripe_setup_intent_id) values($1,'cus_test','scheduled',1000,$2,'fingerprint','seti_test')`, [order, '22222222-2222-4222-8222-222222222222'])
  await db.query(`insert into scheduled_payments(order_id,amount,run_at_date,status,currency,payment_method_id) values($1,1000,current_date,'scheduled','usd','pm_pending')`, [order])
  await assert.rejects(() => db.query(`insert into scheduled_payments(order_id,amount,run_at_date,status,currency,payment_method_id) values($1,1000,current_date,'scheduled','usd','pm_pending')`, [order]))
  const workerA = await db.query(`select * from public.claim_due_scheduled_payments(25, interval '15 minutes')`)
  const workerB = await db.query(`select * from public.claim_due_scheduled_payments(25, interval '15 minutes')`)
  assert.equal(workerA.rows.length, 1)
  assert.equal(workerB.rows.length, 0)
  await db.query(`update scheduled_payments set processing_at=now()-interval '16 minutes' where order_id=$1`, [order])
  const staleRecovery = await db.query(`select * from public.claim_due_scheduled_payments(25, interval '15 minutes')`)
  assert.equal(staleRecovery.rows.length, 1)
  await assert.rejects(() => db.exec('set role anon; select * from public.stripe_webhook_events'))
  await db.close()
})

test('distributed limiter and webhook ledger are atomic', async () => {
  const db = await securityDatabase()
  const key = 'a'.repeat(64)
  const calls = []
  for (let i = 0; i < 3; i++) calls.push((await db.query('select * from public.consume_api_rate_limit($1,2,60)', [key])).rows[0].allowed)
  assert.deepEqual(calls, [true, true, false])
  const first = await db.query(`select public.claim_stripe_webhook_event('evt_test_123','setup_intent.succeeded') result`)
  const second = await db.query(`select public.claim_stripe_webhook_event('evt_test_123','setup_intent.succeeded') result`)
  assert.equal(first.rows[0].result, 'claimed')
  assert.equal(second.rows[0].result, 'busy')
  await db.exec(`update stripe_webhook_events set status='processed',processed_at=now() where stripe_event_id='evt_test_123'`)
  const duplicate = await db.query(`select public.claim_stripe_webhook_event('evt_test_123','setup_intent.succeeded') result`)
  assert.equal(duplicate.rows[0].result, 'duplicate')
  await db.close()
})

test('successful Stripe charge finalization is atomic and retry-safe', async () => {
  const db = await securityDatabase()
  const order = '33333333-3333-4333-8333-333333333333'
  const payment = '44444444-4444-4444-8444-444444444444'
  await db.query(`insert into orders(id,stripe_customer_id,status,total_cents) values($1,'cus_atomic','scheduled',1000)`, [order])
  await db.query(`insert into scheduled_payments(id,order_id,amount,run_at_date,status,currency,payment_method_id,processing_at) values($1,$2,1000,current_date,'processing','usd','pm_atomic',now())`, [payment, order])

  await db.exec(`
    create function fail_scheduled_charge() returns trigger language plpgsql as $$
    begin if new.status = 'charged' then raise exception 'scheduled write failed'; end if; return new; end $$;
    create trigger fail_scheduled_charge before update on scheduled_payments
      for each row execute function fail_scheduled_charge();
  `)
  await assert.rejects(() => db.query(
    `select finalize_scheduled_payment_charge($1,$2,'pi_atomic',now())`, [payment, order],
  ))
  let state = await db.query(`select sp.status payment_status,o.status order_status from scheduled_payments sp join orders o on o.id=sp.order_id where sp.id=$1`, [payment])
  assert.deepEqual(state.rows[0], { payment_status: 'processing', order_status: 'scheduled' })
  await db.exec(`drop trigger fail_scheduled_charge on scheduled_payments; drop function fail_scheduled_charge()`)

  await db.exec(`
    create function fail_order_charge() returns trigger language plpgsql as $$
    begin if new.status = 'charged' then raise exception 'order write failed'; end if; return new; end $$;
    create trigger fail_order_charge before update on orders
      for each row execute function fail_order_charge();
  `)
  await assert.rejects(() => db.query(
    `select finalize_scheduled_payment_charge($1,$2,'pi_atomic',now())`, [payment, order],
  ))
  state = await db.query(`select sp.status payment_status,sp.stripe_payment_intent_id,o.status order_status from scheduled_payments sp join orders o on o.id=sp.order_id where sp.id=$1`, [payment])
  assert.deepEqual(state.rows[0], { payment_status: 'processing', stripe_payment_intent_id: null, order_status: 'scheduled' })
  await db.exec(`drop trigger fail_order_charge on orders; drop function fail_order_charge()`)

  const retried = await db.query(`select finalize_scheduled_payment_charge($1,$2,'pi_atomic',now()) result`, [payment, order])
  assert.equal(retried.rows[0].result, 'charged')
  const duplicate = await db.query(`select finalize_scheduled_payment_charge($1,$2,'pi_atomic',now()) result`, [payment, order])
  assert.equal(duplicate.rows[0].result, 'already_charged')
  await assert.rejects(() => db.query(
    `select finalize_scheduled_payment_charge($1,$2,'pi_second',now())`, [payment, order],
  ))
  state = await db.query(`select sp.status payment_status,sp.stripe_payment_intent_id,o.status order_status from scheduled_payments sp join orders o on o.id=sp.order_id where sp.id=$1`, [payment])
  assert.deepEqual(state.rows[0], { payment_status: 'charged', stripe_payment_intent_id: 'pi_atomic', order_status: 'charged' })
  await db.close()
})

test('legacy charged-payment split state reconciles without Stripe', async () => {
  const db = await securityDatabase()
  const order = '55555555-5555-4555-8555-555555555555'
  await db.query(`insert into orders(id,stripe_customer_id,status,total_cents) values($1,'cus_reconcile','scheduled',1000)`, [order])
  await db.query(`insert into scheduled_payments(order_id,amount,run_at_date,status,currency,payment_method_id,stripe_payment_intent_id,charged_at) values($1,1000,current_date,'charged','usd','pm_reconcile','pi_reconcile',now())`, [order])
  const reconciled = await db.query(`select reconcile_terminal_scheduled_payment_orders(100) result`)
  assert.equal(Number(reconciled.rows[0].result), 1)
  const state = await db.query(`select status from orders where id=$1`, [order])
  assert.equal(state.rows[0].status, 'charged')
  await assert.rejects(() => db.exec(`set role anon; select reconcile_terminal_scheduled_payment_orders(100)`))
  await db.close()
})
