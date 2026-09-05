import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { canCancelScheduledPayment } from '../lib/account-security.ts'
import { shouldRedirectAccountRequest } from '../lib/account-auth.ts'
import { checkoutOwnerMatches } from '../lib/checkout-owner.ts'

test('unauthenticated account access is redirected to login', async () => {
  assert.equal(shouldRedirectAccountRequest('/account', null), true)
  assert.equal(shouldRedirectAccountRequest('/account/history', null), true)
  assert.equal(shouldRedirectAccountRequest('/account', 'user-a'), false)
  assert.equal(shouldRedirectAccountRequest('/demo', null), false)
})

test('checkout assigns a verified user and preserves anonymous checkout', async () => {
  const checkout = await readFile('app/api/checkout/start/route.ts', 'utf8')
  assert.match(checkout, /const userId = await getVerifiedUserId\(\)/)
  assert.match(checkout, /user_id: userId/)
  assert.doesNotMatch(checkout, /user_id: null/)
  assert.equal(checkoutOwnerMatches('user-a', 'user-a'), true)
  assert.equal(checkoutOwnerMatches('user-b', 'user-a'), false)
  assert.equal(checkoutOwnerMatches(null, null), true)
  assert.equal(checkoutOwnerMatches(null, 'user-a'), false)
})

test('only unclaimed scheduled payments are cancellable', () => {
  assert.equal(canCancelScheduledPayment('scheduled', null), true)
  for (const status of ['processing', 'charged', 'failed', 'cancelled']) {
    assert.equal(canCancelScheduledPayment(status, null), false)
  }
  assert.equal(canCancelScheduledPayment('scheduled', '2026-09-05T12:00:00Z'), false)
})

test('production payment executor implementation is not modified by Account v1', async () => {
  const executor = await readFile('supabase/functions/charge_due/index.ts', 'utf8')
  assert.match(executor, /paymentIntentIdempotencyKey/)
  assert.match(executor, /claim_due_scheduled_payments/)
  assert.match(executor, /finalize_scheduled_payment_charge/)
})
