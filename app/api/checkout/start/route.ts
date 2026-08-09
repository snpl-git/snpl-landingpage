export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  MAX_CART_QUANTITY,
  MAX_CART_TOTAL_CENTS,
  MAX_DISTINCT_ITEMS,
  MAX_QUANTITY_PER_ITEM,
  CHECKOUT_COOKIE,
  createCheckoutToken,
  consumeCheckoutRateLimit,
  getClientAddress,
  hashRequest,
  parseScheduleDate,
} from '@/lib/checkout-security'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'

const Body = z
  .object({
    requestId: z.string().uuid(),
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          qty: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
        }).strict()
      )
      .min(1)
      .max(MAX_DISTINCT_ITEMS),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .superRefine(({ items }, context) => {
    if (new Set(items.map(({ id }) => id)).size !== items.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate products are not allowed' })
    }
    if (items.reduce((sum, item) => sum + item.qty, 0) > MAX_CART_QUANTITY) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cart quantity is too large' })
    }
  })

type CheckoutResult = { fingerprint: string; orderId: string }
const globalRequests = globalThis as typeof globalThis & {
  snplCheckoutRequests?: Map<string, CheckoutResult>
}
const checkoutRequests = globalRequests.snplCheckoutRequests ?? new Map<string, CheckoutResult>()
globalRequests.snplCheckoutRequests = checkoutRequests

const genericServerError = () =>
  NextResponse.json({ error: 'Unable to start checkout' }, { status: 500 })

function checkoutResponse(orderId: string, status = 200) {
  const response = NextResponse.json(
    { orderId },
    { status, headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } }
  )
  response.cookies.set(CHECKOUT_COOKIE, createCheckoutToken(orderId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 60,
  })
  return response
}

export async function POST(req: Request) {
  const rateLimit = consumeCheckoutRateLimit(getClientAddress(req.headers))
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    )
  }

  try {
    const supaAdmin = getCheckoutAdmin()
    const stripe = getStripe()
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 415 })
    }

    const parsed = Body.safeParse(await req.json())
    if (!parsed.success || !parseScheduleDate(parsed.success ? parsed.data.date : '')) {
      return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 })
    }

    const { items, date, requestId } = parsed.data
    const fingerprint = hashRequest({ items, date })
    const prior = checkoutRequests.get(requestId)
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        return NextResponse.json({ error: 'Request identifier has already been used' }, { status: 409 })
      }
      if (!prior.orderId) {
        return NextResponse.json({ error: 'Checkout request is already processing' }, { status: 409 })
      }
      return checkoutResponse(prior.orderId)
    }

    const { data: products, error: productError } = await supaAdmin
      .from('products')
      .select('id, price_cents, active')
      .in('id', items.map(({ id }) => id))
      .eq('active', true)

    if (productError) {
      console.error('Checkout product lookup failed', productError)
      return genericServerError()
    }
    if (!products || products.length !== items.length) {
      return NextResponse.json({ error: 'Cart contains an unavailable product' }, { status: 400 })
    }

    const quantities = new Map(items.map(({ id, qty }) => [id, qty]))
    const totalCents = products.reduce(
      (sum, product) => sum + product.price_cents * (quantities.get(product.id) ?? 0),
      0
    )
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > MAX_CART_TOTAL_CENTS) {
      return NextResponse.json({ error: 'Cart total is outside the allowed range' }, { status: 400 })
    }

    // Reserve this request ID before external calls so concurrent retries cannot create duplicate orders.
    checkoutRequests.set(requestId, { fingerprint, orderId: '' })

    const customer = await stripe.customers.create(
      { description: 'SNPL demo customer', metadata: { checkout_request_id: requestId } },
      { idempotencyKey: `snpl-customer-${requestId}` }
    )

    const { data: order, error: orderError } = await supaAdmin
      .from('orders')
      .insert({
        user_id: null,
        total_cents: totalCents,
        status: 'scheduled',
        stripe_customer_id: customer.id,
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('Checkout order insert failed', orderError)
      checkoutRequests.delete(requestId)
      return genericServerError()
    }
    checkoutRequests.set(requestId, { fingerprint, orderId: order.id })

    const setupIntent = await stripe.setupIntents.create(
      {
        customer: customer.id,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: { order_id: order.id, checkout_request_id: requestId },
      },
      { idempotencyKey: `snpl-setup-${requestId}` }
    )

    if (!setupIntent.client_secret) {
      console.error('Stripe returned a SetupIntent without a client secret', setupIntent.id)
      return genericServerError()
    }

    const { error: scheduleError } = await supaAdmin.from('scheduled_payments').insert({
      order_id: order.id,
      amount: totalCents,
      run_at_date: date,
      payment_method_id: 'pm_pending',
      currency: 'usd',
    })

    if (scheduleError) {
      console.error('Checkout schedule insert failed', scheduleError)
      await stripe.setupIntents.cancel(setupIntent.id).catch((error) =>
        console.error('Failed to cancel orphaned SetupIntent', error)
      )
      return genericServerError()
    }

    checkoutRequests.set(requestId, { fingerprint, orderId: order.id })
    return checkoutResponse(order.id, 201)
  } catch (error) {
    console.error('Checkout start failed', error)
    return genericServerError()
  }
}
