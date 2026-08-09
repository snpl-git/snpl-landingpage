import assert from 'node:assert/strict'
import test from 'node:test'
import { checkoutTokenForOrder, createCheckoutToken, hashRequest, parseScheduleDate } from '../lib/checkout-security.ts'
import { readJsonBody, RequestBodyError } from '../lib/request-security.ts'
import { CheckoutBodySchema } from '../lib/checkout-input.ts'

process.env.CHECKOUT_SESSION_SECRET = 'test-only-secret-that-is-at-least-32-characters'
const orderA = '11111111-1111-4111-8111-111111111111'
const orderB = '22222222-2222-4222-8222-222222222222'
const headersFor = (token: string) => new Headers({ cookie: `snpl_checkout=${encodeURIComponent(token)}` })

test('checkout token is valid only for its order and lifetime', () => {
  const now = Date.UTC(2026, 7, 9, 12)
  const token = createCheckoutToken(orderA, 3, now)
  assert.equal(checkoutTokenForOrder(headersFor(token), orderA, now)?.sv, 3)
  assert.equal(checkoutTokenForOrder(headersFor(token), orderB, now), null)
  assert.equal(checkoutTokenForOrder(headersFor(token), orderA, now + 30 * 60_000), null)
})

test('tampered checkout token fails', () => {
  const token = createCheckoutToken(orderA)
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`
  assert.equal(checkoutTokenForOrder(headersFor(tampered), orderA), null)
  assert.equal(checkoutTokenForOrder(headersFor(`${token}.extra`), orderA), null)
})

test('schedule date rejects past, malformed and over-window values', () => {
  const now = new Date('2026-08-09T12:00:00Z')
  assert.equal(parseScheduleDate('2026-08-09', now), '2026-08-09')
  assert.equal(parseScheduleDate('2026-08-08', now), null)
  assert.equal(parseScheduleDate('2026-11-08', now), null)
  assert.equal(parseScheduleDate('2026-02-30', now), null)
})

test('bounded JSON reader rejects malformed and oversized bodies', async () => {
  await assert.rejects(() => readJsonBody(new Request('http://local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), 32), (error: unknown) => error instanceof RequestBodyError && error.status === 400)
  await assert.rejects(() => readJsonBody(new Request('http://local', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(100) }) }), 32), (error: unknown) => error instanceof RequestBodyError && error.status === 413)
})

test('checkout schema rejects tampering and invalid quantities', () => {
  const base = { requestId: orderA, items: [{ id: 'product-a', qty: 1 }], date: '2026-08-12' }
  assert.equal(CheckoutBodySchema.safeParse(base).success, true)
  assert.equal(CheckoutBodySchema.safeParse({ ...base, price: 1 }).success, false)
  assert.equal(CheckoutBodySchema.safeParse({ ...base, currency: 'eur' }).success, false)
  assert.equal(CheckoutBodySchema.safeParse({ ...base, items: [{ id: 'product-a', qty: 0 }] }).success, false)
  assert.equal(CheckoutBodySchema.safeParse({ ...base, items: [{ id: 'product-a', qty: -1 }] }).success, false)
  assert.equal(CheckoutBodySchema.safeParse({ ...base, items: [{ id: 'product-a', qty: 11 }] }).success, false)
  assert.equal(CheckoutBodySchema.safeParse({ ...base, items: [{ id: 'product-a', qty: 1 }, { id: 'product-a', qty: 1 }] }).success, false)
})

test('request fingerprints are stable and detect conflicting replay', () => {
  const payload = { items: [{ id: 'product-a', qty: 1 }], date: '2026-08-12' }
  assert.equal(hashRequest(payload), hashRequest(payload))
  assert.notEqual(hashRequest(payload), hashRequest({ ...payload, date: '2026-08-13' }))
})
