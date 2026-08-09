export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'
import { checkoutTokenForOrder } from '@/lib/checkout-security'
import { consumeRateLimit, RATE_LIMITS, trustedClientIp } from '@/lib/rate-limit'
import { securityError, securityLog } from '@/lib/security-log'

export async function GET(req: Request) {
  try {
    const rateLimit = await consumeRateLimit(RATE_LIMITS.checkoutStatus, trustedClientIp(req.headers))
    if (!rateLimit.allowed) return NextResponse.json({ error: 'Order status unavailable' }, { status: rateLimit.unavailable ? 503 : 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } })
    const orderId = z.string().uuid().safeParse(new URL(req.url).searchParams.get('order'))
    if (!orderId.success) {
      return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
    }
    const token = checkoutTokenForOrder(req.headers, orderId.data)
    if (!token) {
      securityLog('checkout_status_denied', { route: 'checkout-status', orderId: orderId.data })
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const tokenLimit = await consumeRateLimit(RATE_LIMITS.checkoutStatusToken, orderId.data)
    if (!tokenLimit.allowed) return NextResponse.json({ error: 'Order status unavailable' }, { status: tokenLimit.unavailable ? 503 : 429, headers: { 'Retry-After': String(tokenLimit.retryAfterSeconds) } })
    const supaAdmin = getCheckoutAdmin()
    const stripe = getStripe()

    const { data: order, error: orderError } = await supaAdmin
      .from('orders')
      .select('id, total_cents, status, stripe_customer_id, stripe_setup_intent_id, checkout_session_version')
      .eq('id', orderId.data)
      .single()
    if (orderError || !order?.stripe_customer_id || !order.stripe_setup_intent_id || order.checkout_session_version !== token.sv) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: scheduled, error: scheduledError } = await supaAdmin
      .from('scheduled_payments')
      .select('run_at_date, amount, currency, payment_method_id')
      .eq('order_id', order.id)
      .single()
    if (scheduledError || !scheduled) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const setupIntent = await stripe.setupIntents.retrieve(order.stripe_setup_intent_id)
    const intentCustomer =
      typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id
    const authorized =
      setupIntent.metadata?.order_id === order.id &&
      intentCustomer === order.stripe_customer_id &&
      setupIntent.status === 'succeeded' &&
      scheduled.payment_method_id !== 'pm_pending' &&
      scheduled.amount === order.total_cents

    if (!authorized) {
      return NextResponse.json(
        { authorized: false, status: 'processing' },
        { status: 202, headers: { 'Cache-Control': 'no-store, private' } }
      )
    }

    return NextResponse.json(
      {
        authorized: true,
        orderId: order.id,
        amount: scheduled.amount,
        currency: scheduled.currency,
        date: scheduled.run_at_date,
        status: order.status,
      },
      { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } }
    )
  } catch {
    securityError('checkout_status_failed', { route: 'checkout-status' })
    return NextResponse.json({ error: 'Unable to verify order' }, { status: 500 })
  }
}
