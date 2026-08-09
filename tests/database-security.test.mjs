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
    create table public.orders(
      id uuid primary key default gen_random_uuid(), stripe_customer_id text, status text,
      total_cents integer, user_id uuid references auth.users(id), checkout_request_id uuid,
      checkout_request_fingerprint text, stripe_setup_intent_id text
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
    'supabase/migrations/20260809173246_security_pass_2_payment_integrity.sql',
    'supabase/migrations/20260809173247_security_pass_2_rate_limits_webhooks.sql',
  ]) await db.exec(await readFile(migration, 'utf8'))
  return db
}

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
