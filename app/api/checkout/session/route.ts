export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'
import { checkoutTokenForOrder } from '@/lib/checkout-security'
import { consumeRateLimit, RATE_LIMITS, trustedClientIp } from '@/lib/rate-limit'
import { securityError, securityLog } from '@/lib/security-log'

const OrderId = z.string().uuid()

export async function GET(req: Request) {
  try {
    const rateLimit = await consumeRateLimit(RATE_LIMITS.checkoutSession, trustedClientIp(req.headers))
    if (!rateLimit.allowed) return NextResponse.json({ error: 'Checkout session unavailable' }, { status: rateLimit.unavailable ? 503 : 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
    const orderId = OrderId.safeParse(new URL(req.url).searchParams.get('order'))
    if (!orderId.success) {
      return NextResponse.json({ error: 'Invalid checkout session' }, { status: 400 })
    }
    const token = checkoutTokenForOrder(req.headers, orderId.data)
    if (!token) {
      securityLog('checkout_session_denied', { route: 'checkout-session', orderId: orderId.data })
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 })
    }
    const tokenLimit = await consumeRateLimit(RATE_LIMITS.checkoutSessionToken, orderId.data)
    if (!tokenLimit.allowed) return NextResponse.json({ error: 'Checkout session unavailable' }, { status: tokenLimit.unavailable ? 503 : 429, headers: { 'Retry-After': String(tokenLimit.retryAfterSeconds) } })
    const supaAdmin = getCheckoutAdmin()
    const stripe = getStripe()

    const { data: order, error } = await supaAdmin
      .from('orders')
      .select('id, stripe_customer_id, stripe_setup_intent_id, checkout_session_version')
      .eq('id', orderId.data)
      .single()
    if (error || !order?.stripe_customer_id || !order.stripe_setup_intent_id || order.checkout_session_version !== token.sv) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 })
    }

    const intent = await stripe.setupIntents.retrieve(order.stripe_setup_intent_id)
    const intentCustomer = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id
    if (
      intent.metadata?.order_id !== order.id ||
      intentCustomer !== order.stripe_customer_id ||
      !intent.client_secret ||
      ['canceled', 'succeeded'].includes(intent.status)
    ) {
      return NextResponse.json({ error: 'Checkout session is not available' }, { status: 409 })
    }

    return NextResponse.json(
      { clientSecret: intent.client_secret },
      { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } }
    )
  } catch {
    securityError('checkout_session_failed', { route: 'checkout-session' })
    return NextResponse.json({ error: 'Unable to load checkout session' }, { status: 500 })
  }
}
