// app/api/checkout/start/route.ts
// Ensure this runs on Node (Stripe SDK needs Node, not Edge)
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using the SERVICE ROLE key (bypasses RLS for secure writes)
const supaAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const Body = z.object({
  items: z.array(z.object({ id: z.string(), qty: z.number().int().min(1) })).min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
})

export async function POST(req: Request) {
  try {
    // 1) Validate body
    const body = await req.json()
    const parsed = Body.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { items, date } = parsed.data

    // 2) Fetch product prices from Supabase
    const { data: prods, error: prodErr } = await supaAdmin
      .from('products')
      .select('id, price_cents')
      .in('id', items.map((i) => i.id))

    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 })
    if (!prods?.length) return NextResponse.json({ error: 'No matching products' }, { status: 400 })

    const totalCents = prods.reduce((sum, p) => {
      const qty = items.find((i) => i.id === p.id)?.qty ?? 0
      return sum + qty * p.price_cents
    }, 0)

    if (totalCents <= 0) {
      return NextResponse.json({ error: 'Cart total must be greater than 0' }, { status: 400 })
    }

    // 3) Create a Stripe customer for this demo order
    const customer = await stripe.customers.create({ description: 'SNPL demo customer' })

    // 4) Create a SetupIntent to save PM for future off-session charge
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session',
    })

    // 5) Insert order + scheduled payment rows
    const { data: orderRow, error: orderErr } = await supaAdmin
      .from('orders')
      .insert({
        user_id: null, // no auth for MVP
        total_cents: totalCents,
        status: 'scheduled',
        stripe_customer_id: customer.id,
      })
      .select('*')
      .single()

    if (orderErr || !orderRow) {
      return NextResponse.json(
        { error: orderErr?.message || 'Failed to create order' },
        { status: 500 }
      )
    }

    const { error: schedErr } = await supaAdmin.from('scheduled_payments').insert({
      order_id: orderRow.id,
      run_at_date: date, // YYYY-MM-DD
      payment_method_id: 'pm_pending', // will be replaced by webhook
      currency: 'usd',
    })

    if (schedErr) {
      return NextResponse.json({ error: schedErr.message }, { status: 500 })
    }

    // 6) Return clientSecret for Stripe Elements on /demo/confirm
    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      orderId: orderRow.id,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
