export const runtime = 'nodejs'

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'

const OrderId = z.string().uuid()

export async function POST(req: Request) {
  try {
    const stripe = getStripe()
    const supaAdmin = getCheckoutAdmin()
    const signature = (await headers()).get('stripe-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Invalid webhook request' }, { status: 400 })
    }

    const event = stripe.webhooks.constructEvent(
      Buffer.from(await req.arrayBuffer()),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    if (event.type === 'setup_intent.succeeded') {
      const setupIntent = event.data.object as Stripe.SetupIntent
      const orderId = OrderId.safeParse(setupIntent.metadata?.order_id)
      const paymentMethod =
        typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id
      const customer =
        typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id

      if (!orderId.success || !paymentMethod || !customer) {
        console.error('Succeeded SetupIntent is missing required SNPL metadata', setupIntent.id)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
      }

      const { data: order, error: orderError } = await supaAdmin
        .from('orders')
        .select('id')
        .eq('id', orderId.data)
        .eq('stripe_customer_id', customer)
        .single()
      if (orderError || !order) {
        console.error('SetupIntent order/customer validation failed', setupIntent.id, orderError)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
      }

      const { error: updateError } = await supaAdmin
        .from('scheduled_payments')
        .update({ payment_method_id: paymentMethod })
        .eq('order_id', order.id)
        .eq('payment_method_id', 'pm_pending')
      if (updateError) {
        console.error('Scheduled payment authorization update failed', updateError)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook rejected', error)
    return NextResponse.json({ error: 'Invalid webhook request' }, { status: 400 })
  }
}
