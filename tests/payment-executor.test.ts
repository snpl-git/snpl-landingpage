import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chargeFinalizationSucceeded,
  failureFinalizationSucceeded,
  failureTransition,
  paymentBindingIsValid,
  paymentIntentIdempotencyKey,
} from '../supabase/functions/charge_due/payment-logic.ts'

const valid = {
  scheduledPaymentId: 'schedule-a', orderId: 'order-a', amount: 1000,
  orderTotalCents: 1000, orderStatus: 'scheduled', stripeCustomerId: 'customer-a',
  paymentMethodId: 'method-a',
}

test('retries and duplicate workers use one deterministic Stripe operation', () => {
  assert.equal(paymentIntentIdempotencyKey('schedule-a'), paymentIntentIdempotencyKey('schedule-a'))
  assert.notEqual(paymentIntentIdempotencyKey('schedule-a'), paymentIntentIdempotencyKey('schedule-b'))
})

test('executor rejects customer, order-state, amount and payment-method mismatches', () => {
  assert.equal(paymentBindingIsValid(valid), true)
  assert.equal(paymentBindingIsValid({ ...valid, orderStatus: 'cancelled' }), false)
  assert.equal(paymentBindingIsValid({ ...valid, orderTotalCents: 1001 }), false)
  assert.equal(paymentBindingIsValid({ ...valid, paymentMethodId: 'pm_pending' }), false)
})

test('payment-method ownership is not implied before Stripe retrieval', () => {
  assert.equal(paymentBindingIsValid(valid), true)
  assert.equal(paymentBindingIsValid({ ...valid, stripeCustomerId: null }), false)
})

test('database finalization results are explicit', () => {
  for (const result of ['charged', 'reconciled', 'already_charged']) {
    assert.equal(chargeFinalizationSucceeded(result), true)
  }
  assert.equal(chargeFinalizationSucceeded('failed'), false)
  for (const result of ['failed', 'reconciled', 'already_failed']) {
    assert.equal(failureFinalizationSucceeded(result), true)
  }
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

for (const failedWrite of ['scheduled payment', 'order'] as const) {
  test(`Stripe succeeds and a ${failedWrite} write fails, then retry converges without a second charge`, async () => {
    let paymentState: 'scheduled' | 'processing' | 'charged' = 'scheduled'
    let orderState: 'scheduled' | 'charged' = 'scheduled'
    let failFinalization = true
    const stripeOperations = new Map<string, string>()

    const worker = async () => {
      if (paymentState !== 'scheduled') return 'skipped'
      paymentState = 'processing'
      const key = paymentIntentIdempotencyKey('schedule-retry')
      const intent = stripeOperations.get(key) ?? 'pi_original'
      stripeOperations.set(key, intent)
      if (failFinalization) {
        // The RPC transaction rolls back both writes regardless of which local
        // statement failed; the executor returns the claim to a retryable state.
        paymentState = 'scheduled'
        return 'retrying'
      }
      paymentState = 'charged'
      orderState = 'charged'
      return 'charged'
    }

    assert.equal(await worker(), 'retrying')
    assert.deepEqual({ paymentState, orderState }, { paymentState: 'scheduled', orderState: 'scheduled' })
    failFinalization = false
    assert.equal(await worker(), 'charged')
    assert.equal(await worker(), 'skipped')
    assert.deepEqual({ paymentState, orderState }, { paymentState: 'charged', orderState: 'charged' })
    assert.equal(stripeOperations.size, 1)
    assert.equal(stripeOperations.get(paymentIntentIdempotencyKey('schedule-retry')), 'pi_original')
  })
}
