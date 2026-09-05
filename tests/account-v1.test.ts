import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { canCancelScheduledPayment } from '../lib/account-security.ts'
import { shouldRedirectAccountRequest } from '../lib/account-auth.ts'
import { checkoutOwnerMatches } from '../lib/checkout-owner.ts'
import { EmailAuthRequestSchema, emailOtpCredentials } from '../lib/auth-input.ts'
import { canRegisterPasskey } from '../lib/passkey-security.ts'

test('overview counts all owner-scoped scheduled orders separately from recent activity', async () => {
  const overview = await readFile('app/account/page.tsx', 'utf8')
  assert.match(overview, /select\('id', \{ count: 'exact', head: true \}\)\.eq\('user_id', userId\)\.eq\('status', 'scheduled'\)/)
  assert.match(overview, /order\('created_at', \{ ascending: false \}\)\.limit\(5\)/)
  assert.doesNotMatch(overview, /orders\?\.filter/)
})

test('email bootstrap requires a shaped CAPTCHA token and passes it to Supabase options', () => {
  const valid = { email: 'customer@example.com', captchaToken: 'turnstile-token-with-safe-length' }
  assert.equal(EmailAuthRequestSchema.safeParse(valid).success, true)
  assert.equal(EmailAuthRequestSchema.safeParse({ email: valid.email }).success, false)
  assert.equal(EmailAuthRequestSchema.safeParse({ ...valid, email: 'not-an-email' }).success, false)
  assert.equal(EmailAuthRequestSchema.safeParse({ ...valid, captchaToken: 'short' }).success, false)
  assert.equal(EmailAuthRequestSchema.safeParse({ ...valid, captchaToken: `${'a'.repeat(20)} token` }).success, false)
  assert.deepEqual(emailOtpCredentials(valid), {
    email: valid.email,
    options: { captchaToken: valid.captchaToken },
  })
})

test('email bootstrap uses the protected initiation route and resets CAPTCHA', async () => {
  const login = await readFile('app/login/login-form.tsx', 'utf8')
  const route = await readFile('app/api/auth/email/route.ts', 'utf8')
  assert.match(login, /submit\('\/api\/auth\/email', \{ email, captchaToken \}\)/)
  assert.match(route, /RATE_LIMITS\.authEmailSend/)
  assert.match(route, /signInWithOtp\(emailOtpCredentials\(parsed\.data\)\)/)
  assert.match(login, /setCaptchaToken\(''\)/)
  assert.match(login, /setCaptchaResetKey\(\(value\) => value \+ 1\)/)
})

test('passkey client opt-in and identifier-free sign-in path are present', async () => {
  const client = await readFile('lib/supabase.ts', 'utf8')
  const login = await readFile('app/login/login-form.tsx', 'utf8')
  assert.match(client, /experimental: \{ passkey: true \}/)
  assert.match(login, /auth\.signInWithPasskey\(\)/)
  assert.match(login, /'Sign in with passkey'/)
})

test('passkey registration requires an authenticated user', async () => {
  const manager = await readFile('app/account/security/passkey-manager.tsx', 'utf8')
  assert.equal(canRegisterPasskey(null), false)
  assert.equal(canRegisterPasskey('user-a'), true)
  assert.match(manager, /auth\.getClaims\(\)/)
  assert.match(manager, /auth\.registerPasskey\(\)/)
  assert.match(manager, /auth\.passkey\.list\(\)/)
})

test('content security policy permits the Turnstile challenge origin', async () => {
  const config = await readFile('next.config.mjs', 'utf8')
  const occurrences = config.match(/https:\/\/challenges\.cloudflare\.com/g) || []
  assert.equal(occurrences.length, 3)
})

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
