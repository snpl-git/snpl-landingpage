export const runtime = 'nodejs'

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  MAX_CART_TOTAL_CENTS,
  CHECKOUT_COOKIE,
  createCheckoutToken,
  hashRequest,
  parseScheduleDate,
} from '@/lib/checkout-security'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'
import { consumeRateLimit, RATE_LIMITS, trustedClientIp } from '@/lib/rate-limit'
import { readJsonBody, RequestBodyError } from '@/lib/request-security'
import { securityError, securityLog } from '@/lib/security-log'
import { CheckoutBodySchema } from '@/lib/checkout-input'

type CheckoutResult = { fingerprint: string; orderId: string }
const globalRequests = globalThis as typeof globalThis & {
  snplCheckoutRequests?: Map<string, CheckoutResult>
}
const checkoutRequests = globalRequests.snplCheckoutRequests ?? new Map<string, CheckoutResult>()
globalRequests.snplCheckoutRequests = checkoutRequests

const genericServerError = () =>
  NextResponse.json({ error: 'Unable to start checkout' }, { status: 500 })

function checkoutResponse(orderId: string, sessionVersion: number, status = 200) {
  const response = NextResponse.json(
    { orderId },
    { status, headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } }
  )
  response.cookies.set(CHECKOUT_COOKIE, createCheckoutToken(orderId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 60,
  })
  return response
}

export async function POST(req: Request) {
  const rateLimit = await consumeRateLimit(RATE_LIMITS.checkoutStart, trustedClientIp(req.headers))
  if (!rateLimit.allowed) {
    const status = rateLimit.unavailable ? 503 : 429
    return NextResponse.json(
      { error: status === 503 ? 'Checkout is temporarily unavailable' : 'Too many checkout attempts. Please try again shortly.' },
      { status, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds), 'X-SNPL-Challenge': status === 429 ? 'required' : 'unavailable' } }
    )
  }

  try {
    const parsed = CheckoutBodySchema.safeParse(await readJsonBody(req, 16 * 1024))
    if (!parsed.success || !parseScheduleDate(parsed.success ? parsed.data.date : '')) {
      return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 })
    }

    const { items, date, requestId } = parsed.data
    const supaAdmin = getCheckoutAdmin()
    const stripe = getStripe()
    const fingerprint = hashRequest({ items, date })
    const prior = checkoutRequests.get(requestId)
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        return NextResponse.json({ error: 'Request identifier has already been used' }, { status: 409 })
      }
      if (!prior.orderId) {
        return NextResponse.json({ error: 'Checkout request is already processing' }, { status: 409 })
      }
      const { data: priorOrder } = await supaAdmin.from('orders')
        .select('checkout_session_version').eq('id', prior.orderId).single()
      if (!priorOrder?.checkout_session_version) return genericServerError()
      return checkoutResponse(prior.orderId, priorOrder.checkout_session_version)
    }

    const { data: products, error: productError } = await supaAdmin
      .from('products')
      .select('id, price_cents, active')
      .in('id', items.map(({ id }) => id))
      .eq('active', true)

    if (productError) {
      securityError('checkout_product_lookup_failed', { route: 'checkout-start' })
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
        'id, total_cents, stripe_customer_id, checkout_request_id, checkout_request_fingerprint, stripe_setup_intent_id, checkout_session_version'
      const { data: existingOrder, error: existingOrderError } = await supaAdmin
        .from('orders')
        .select(orderColumns)
        .eq('checkout_request_id', requestId)
        .maybeSingle()

      if (existingOrderError) {
        securityError('checkout_idempotency_lookup_failed', { route: 'checkout-start', requestId })
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

        const proposedOrderId = randomUUID()
        const setupIntent = await stripe.setupIntents.create(
          {
            customer: customer.id,
            payment_method_types: ['card'],
            usage: 'off_session',
            metadata: { order_id: proposedOrderId, checkout_request_id: requestId },
          },
          { idempotencyKey: `snpl-setup-${requestId}` }
        )
        const orderId = setupIntent.metadata?.order_id
        if (
          !setupIntent.client_secret ||
          !orderId ||
          setupIntent.metadata?.checkout_request_id !== requestId ||
          setupIntent.customer !== customer.id
        ) {
          securityError('checkout_setup_intent_binding_failed', { route: 'checkout-start', requestId })
          return genericServerError()
        }

        const { data: insertedOrder, error: orderError } = await supaAdmin
          .from('orders')
          .insert({
            id: orderId,
            user_id: null,
            total_cents: totalCents,
            status: 'scheduled',
            stripe_customer_id: customer.id,
            checkout_request_id: requestId,
            checkout_request_fingerprint: fingerprint,
            stripe_setup_intent_id: setupIntent.id,
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
            securityError('checkout_race_recovery_failed', { route: 'checkout-start', requestId })
            return genericServerError()
          }
          order = racedOrder
        } else if (orderError || !insertedOrder) {
          securityError('checkout_order_insert_failed', { route: 'checkout-start', requestId })
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
          securityError('checkout_persistence_validation_failed', { route: 'checkout-start', requestId })
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
        securityError('checkout_schedule_lookup_failed', { route: 'checkout-start', requestId })
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
          securityError('checkout_setup_intent_missing', { route: 'checkout-start', orderId: order.id })
          return genericServerError()
        }
        if (!(await checkoutIsPersisted(order.stripe_setup_intent_id))) {
          return genericServerError()
        }
        checkoutUsable = true
        checkoutRequests.set(requestId, { fingerprint, orderId: order.id })
        return checkoutResponse(order.id, order.checkout_session_version)
      }

      let setupIntentId = order.stripe_setup_intent_id
      if (setupIntentId) {
        const persistedIntent = await stripe.setupIntents.retrieve(setupIntentId)
        if (
          persistedIntent.metadata?.order_id !== order.id ||
          persistedIntent.customer !== order.stripe_customer_id ||
          persistedIntent.status === 'canceled'
        ) {
          securityError('checkout_setup_intent_binding_failed', { route: 'checkout-start', orderId: order.id })
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
          securityError('checkout_setup_intent_incomplete', { route: 'checkout-start', orderId: order.id })
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
          securityError('checkout_setup_intent_persistence_failed', { route: 'checkout-start', orderId: order.id })
          return genericServerError()
        }
        if (persistedOrder?.stripe_setup_intent_id !== setupIntentId) {
          const { data: racedIntent, error: racedIntentError } = await supaAdmin
            .from('orders')
            .select('stripe_setup_intent_id')
            .eq('id', order.id)
            .single()
          if (racedIntentError || racedIntent?.stripe_setup_intent_id !== setupIntentId) {
            securityError('checkout_setup_intent_race_failed', { route: 'checkout-start', orderId: order.id })
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
          securityError('checkout_schedule_insert_failed', { route: 'checkout-start', orderId: order.id })
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
          securityError('checkout_schedule_race_failed', { route: 'checkout-start', orderId: order.id })
          return genericServerError()
        }
      }

      checkoutUsable = true
      checkoutRequests.set(requestId, { fingerprint, orderId: order.id })
      securityLog('checkout_created', { orderId: order.id, requestId })
      return checkoutResponse(order.id, order.checkout_session_version, created ? 201 : 200)
    } finally {
      if (!checkoutUsable) checkoutRequests.delete(requestId)
    }
  } catch (error) {
    if (error instanceof RequestBodyError) {
      securityLog('checkout_request_rejected', { route: 'checkout-start', status: error.status })
      return NextResponse.json({ error: 'Invalid checkout request' }, { status: error.status })
    }
    securityError('checkout_start_failed', { route: 'checkout-start' })
    return genericServerError()
  }
}
