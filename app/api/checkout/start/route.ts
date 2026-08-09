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
          id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
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
    let checkoutUsable = false

    try {
      const orderColumns =
        'id, total_cents, stripe_customer_id, checkout_request_id, checkout_request_fingerprint, stripe_setup_intent_id'
      const { data: existingOrder, error: existingOrderError } = await supaAdmin
        .from('orders')
        .select(orderColumns)
        .eq('checkout_request_id', requestId)
        .maybeSingle()

      if (existingOrderError) {
        console.error('Checkout idempotency lookup failed', existingOrderError)
        return genericServerError()
      }

      let order = existingOrder
      let created = false

      if (order) {
        if (
          order.checkout_request_id !== requestId ||
          order.checkout_request_fingerprint !== fingerprint ||
          order.total_cents !== totalCents
        ) {
          return NextResponse.json(
            { error: 'Request identifier has already been used' },
            { status: 409 }
          )
        }
      } else {
        const customer = await stripe.customers.create(
          { description: 'SNPL demo customer', metadata: { checkout_request_id: requestId } },
          { idempotencyKey: `snpl-customer-${requestId}` }
        )

        const { data: insertedOrder, error: orderError } = await supaAdmin
          .from('orders')
          .insert({
            user_id: null,
            total_cents: totalCents,
            status: 'scheduled',
            stripe_customer_id: customer.id,
            checkout_request_id: requestId,
            checkout_request_fingerprint: fingerprint,
          })
          .select(orderColumns)
          .single()

        if (orderError?.code === '23505') {
          const { data: racedOrder, error: racedOrderError } = await supaAdmin
            .from('orders')
            .select(orderColumns)
            .eq('checkout_request_id', requestId)
            .single()
          if (racedOrderError || !racedOrder) {
            console.error('Checkout race recovery failed', racedOrderError)
            return genericServerError()
          }
          order = racedOrder
        } else if (orderError || !insertedOrder) {
          console.error('Checkout order insert failed', orderError)
          return genericServerError()
        } else {
          order = insertedOrder
          created = true
        }
      }

      if (
        !order ||
        order.checkout_request_id !== requestId ||
        order.checkout_request_fingerprint !== fingerprint ||
        order.total_cents !== totalCents
      ) {
        return NextResponse.json(
          { error: 'Request identifier has already been used' },
          { status: 409 }
        )
      }

      const checkoutIsPersisted = async (setupIntentId: string) => {
        const { data: persistedCheckout, error: persistedCheckoutError } = await supaAdmin
          .from('orders')
          .select(
            'checkout_request_id, checkout_request_fingerprint, stripe_setup_intent_id'
          )
          .eq('id', order.id)
          .single()

        if (
          persistedCheckoutError ||
          persistedCheckout?.checkout_request_id !== requestId ||
          persistedCheckout.checkout_request_fingerprint !== fingerprint ||
          persistedCheckout.stripe_setup_intent_id !== setupIntentId
        ) {
          console.error('Checkout persistence validation failed', persistedCheckoutError)
          return false
        }

        return true
      }

      const { data: existingSchedule, error: scheduleLookupError } = await supaAdmin
        .from('scheduled_payments')
        .select('order_id, amount, run_at_date')
        .eq('order_id', order.id)
        .maybeSingle()
      if (scheduleLookupError) {
        console.error('Checkout schedule lookup failed', scheduleLookupError)
        return genericServerError()
      }
      if (existingSchedule) {
        if (existingSchedule.amount !== totalCents || existingSchedule.run_at_date !== date) {
          return NextResponse.json(
            { error: 'Request identifier has already been used' },
            { status: 409 }
          )
        }
        if (!order.stripe_setup_intent_id) {
          console.error('Usable checkout is missing its persisted SetupIntent', order.id)
          return genericServerError()
        }
        if (!(await checkoutIsPersisted(order.stripe_setup_intent_id))) {
          return genericServerError()
        }
        checkoutUsable = true
        checkoutRequests.set(requestId, { fingerprint, orderId: order.id })
        return checkoutResponse(order.id)
      }

      let setupIntentId = order.stripe_setup_intent_id
      if (setupIntentId) {
        const persistedIntent = await stripe.setupIntents.retrieve(setupIntentId)
        if (
          persistedIntent.metadata?.order_id !== order.id ||
          persistedIntent.customer !== order.stripe_customer_id ||
          persistedIntent.status === 'canceled'
        ) {
          console.error('Persisted SetupIntent failed order validation', setupIntentId)
          return genericServerError()
        }
      } else {
        const setupIntent = await stripe.setupIntents.create(
          {
            customer: order.stripe_customer_id,
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
        setupIntentId = setupIntent.id

        const { data: persistedOrder, error: setupIntentPersistError } = await supaAdmin
          .from('orders')
          .update({ stripe_setup_intent_id: setupIntentId })
          .eq('id', order.id)
          .is('stripe_setup_intent_id', null)
          .select('stripe_setup_intent_id')
          .maybeSingle()
        if (setupIntentPersistError) {
          console.error('SetupIntent persistence failed', setupIntentPersistError)
          return genericServerError()
        }
        if (persistedOrder?.stripe_setup_intent_id !== setupIntentId) {
          const { data: racedIntent, error: racedIntentError } = await supaAdmin
            .from('orders')
            .select('stripe_setup_intent_id')
            .eq('id', order.id)
            .single()
          if (racedIntentError || racedIntent?.stripe_setup_intent_id !== setupIntentId) {
            console.error('SetupIntent persistence race failed validation', racedIntentError)
            return genericServerError()
          }
        }
      }

      if (!setupIntentId || !(await checkoutIsPersisted(setupIntentId))) {
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
        if (scheduleError.code !== '23505') {
          console.error('Checkout schedule insert failed', scheduleError)
          return genericServerError()
        }

        const { data: racedSchedule, error: racedScheduleError } = await supaAdmin
          .from('scheduled_payments')
          .select('amount, run_at_date')
          .eq('order_id', order.id)
          .single()
        if (
          racedScheduleError ||
          racedSchedule?.amount !== totalCents ||
          racedSchedule.run_at_date !== date
        ) {
          console.error('Checkout schedule race failed validation', racedScheduleError)
          return genericServerError()
        }
      }

      checkoutUsable = true
      checkoutRequests.set(requestId, { fingerprint, orderId: order.id })
      return checkoutResponse(order.id, created ? 201 : 200)
    } finally {
      if (!checkoutUsable) checkoutRequests.delete(requestId)
    }
  } catch (error) {
    console.error('Checkout start failed', error)
    return genericServerError()
  }
}
