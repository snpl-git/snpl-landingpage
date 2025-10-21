export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supaAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const sig = (await headers()).get('stripe-signature') as string
    const buf = Buffer.from(await req.arrayBuffer())
    const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!)

    if (event.type === 'setup_intent.succeeded') {
      const si = event.data.object as Stripe.SetupIntent
      const pm = si.payment_method as string
      const customer = si.customer as string

      // find most recent order for this customer
      const { data: orders, error } = await supaAdmin
        .from('orders')
        .select('id')
        .eq('stripe_customer_id', customer)
        .order('created_at', { ascending: false })
        .limit(1)

      if (!error && orders?.[0]?.id) {
        await supaAdmin
          .from('scheduled_payments')
          .update({ payment_method_id: pm })
          .eq('order_id', orders[0].id)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
