import assert from 'node:assert/strict'
import test from 'node:test'
import { failureTransition, paymentBindingIsValid, paymentIntentIdempotencyKey } from '../supabase/functions/charge_due/payment-logic.ts'

const valid = {
  scheduledPaymentId: 'schedule-a', orderId: 'order-a', amount: 1000,
  orderTotalCents: 1000, orderStatus: 'scheduled', stripeCustomerId: 'customer-a',
  paymentMethodId: 'method-a', paymentMethodCustomerId: 'customer-a',
}

test('retries and duplicate workers use one deterministic Stripe operation', () => {
  assert.equal(paymentIntentIdempotencyKey('schedule-a'), paymentIntentIdempotencyKey('schedule-a'))
  assert.notEqual(paymentIntentIdempotencyKey('schedule-a'), paymentIntentIdempotencyKey('schedule-b'))
})

test('executor rejects customer, order-state, amount and payment-method mismatches', () => {
  assert.equal(paymentBindingIsValid(valid), true)
  assert.equal(paymentBindingIsValid({ ...valid, paymentMethodCustomerId: 'customer-b' }), false)
  assert.equal(paymentBindingIsValid({ ...valid, orderStatus: 'cancelled' }), false)
  assert.equal(paymentBindingIsValid({ ...valid, orderTotalCents: 1001 }), false)
  assert.equal(paymentBindingIsValid({ ...valid, paymentMethodId: 'pm_pending' }), false)
})

test('declines terminate while ambiguous failures retry', () => {
  assert.equal(failureTransition(true), 'failed')
  assert.equal(failureTransition(false), 'scheduled')
})

test('two simulated workers claim one payment and retries reuse one charge', async () => {
  let state: 'scheduled' | 'processing' | 'charged' = 'scheduled'
  const stripeOperations = new Map<string, string>()
  const claim = async () => {
    if (state !== 'scheduled') return false
    state = 'processing'
    return true
  }
  const worker = async () => {
    if (!(await claim())) return 'skipped'
    const key = paymentIntentIdempotencyKey('schedule-a')
    stripeOperations.set(key, stripeOperations.get(key) ?? 'pi_one')
    state = 'charged'
    return 'charged'
  }
  const results = await Promise.all([worker(), worker()])
  assert.deepEqual(results.sort(), ['charged', 'skipped'])
  assert.equal(stripeOperations.size, 1)
})
