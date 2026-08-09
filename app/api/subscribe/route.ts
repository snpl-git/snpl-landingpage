import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { consumeRateLimit, RATE_LIMITS, trustedClientIp } from '@/lib/rate-limit'
import { readJsonBody, RequestBodyError } from '@/lib/request-security'
import { securityError, securityLog } from '@/lib/security-log'

const Body = z.object({
  firstName: z.string().trim().max(100).optional().or(z.literal('')),
  email: z.string().trim().email().max(320),
  useCase: z.string().trim().max(100).optional().or(z.literal('')),
}).strict()

export async function POST(req: Request) {
  try {
    const rateLimit = await consumeRateLimit(RATE_LIMITS.subscribe, trustedClientIp(req.headers))
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.unavailable ? 'Signup is temporarily unavailable' : 'Too many signup attempts' },
        { status: rateLimit.unavailable ? 503 : 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      )
    }

    const parsed = Body.safeParse(await readJsonBody(req, 8 * 1024))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    const safeName = parsed.data.firstName?.trim() || 'Waitlist User'

    const { error } = await getCheckoutAdmin().from('waitlist_signups').upsert({
      name: safeName,
      first_name: safeName,
      email: parsed.data.email.toLowerCase(),
      use_case: parsed.data.useCase || null,
    }, { onConflict: 'email', ignoreDuplicates: true })

    if (error) {
      securityError('waitlist_signup_failed', { route: 'subscribe' })
      return NextResponse.json({ error: 'Failed to save signup' }, { status: 500 })
    }
    securityLog('waitlist_signup_accepted', { route: 'subscribe' })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof RequestBodyError) {
      securityLog('waitlist_request_rejected', { route: 'subscribe', status: error.status })
      return NextResponse.json({ error: 'Invalid request body' }, { status: error.status })
    }
    securityError('waitlist_signup_failed', { route: 'subscribe' })
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
