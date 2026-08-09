export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'
import { requestOwnsOrder } from '@/lib/checkout-security'

export async function GET(req: Request) {
  try {
    const supaAdmin = getCheckoutAdmin()
    const stripe = getStripe()
    const orderId = z.string().uuid().safeParse(new URL(req.url).searchParams.get('order'))
    if (!orderId.success) {
      return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
    }
    if (!requestOwnsOrder(req.headers, orderId.data)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: order, error: orderError } = await supaAdmin
      .from('orders')
      .select('id, total_cents, status, stripe_customer_id')
      .eq('id', orderId.data)
      .single()
    if (orderError || !order?.stripe_customer_id) {
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

    const intents = await stripe.setupIntents.list({ customer: order.stripe_customer_id, limit: 10 })
    const setupIntent = intents.data.find((intent) => intent.metadata?.order_id === order.id)
    const authorized =
      setupIntent?.status === 'succeeded' &&
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
  } catch (error) {
    console.error('Checkout status lookup failed', error)
    return NextResponse.json({ error: 'Unable to verify order' }, { status: 500 })
  }
}
