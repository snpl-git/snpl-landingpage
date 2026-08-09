export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'
import { requestOwnsOrder } from '@/lib/checkout-security'

const OrderId = z.string().uuid()

export async function GET(req: Request) {
  try {
    const supaAdmin = getCheckoutAdmin()
    const stripe = getStripe()
    const orderId = OrderId.safeParse(new URL(req.url).searchParams.get('order'))
    if (!orderId.success) {
      return NextResponse.json({ error: 'Invalid checkout session' }, { status: 400 })
    }
    if (!requestOwnsOrder(req.headers, orderId.data)) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 })
    }

    const { data: order, error } = await supaAdmin
      .from('orders')
      .select('id, stripe_customer_id')
      .eq('id', orderId.data)
      .single()
    if (error || !order?.stripe_customer_id) {
      return NextResponse.json({ error: 'Checkout session not found' }, { status: 404 })
    }

    const intents = await stripe.setupIntents.list({ customer: order.stripe_customer_id, limit: 10 })
    const intent = intents.data.find((item) => item.metadata?.order_id === order.id)
    if (!intent?.client_secret || ['canceled', 'succeeded'].includes(intent.status)) {
      return NextResponse.json({ error: 'Checkout session is not available' }, { status: 409 })
    }

    return NextResponse.json(
      { clientSecret: intent.client_secret },
      { headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } }
    )
  } catch (error) {
    console.error('Checkout session lookup failed', error)
    return NextResponse.json({ error: 'Unable to load checkout session' }, { status: 500 })
  }
}
