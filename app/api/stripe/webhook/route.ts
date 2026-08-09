export const runtime = 'nodejs'

import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getStripe } from '@/lib/stripe'
import { securityError, securityLog } from '@/lib/security-log'

const OrderId = z.string().uuid()

export async function POST(req: Request) {
  let signatureVerified = false
  try {
    const stripe = getStripe()
    const supaAdmin = getCheckoutAdmin()
    const signature = (await headers()).get('stripe-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Invalid webhook request' }, { status: 400 })
    }

    const declaredLength = Number(req.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > 256 * 1024) {
      return NextResponse.json({ error: 'Invalid webhook request' }, { status: 413 })
    }
    const rawBody = Buffer.from(await req.arrayBuffer())
    if (rawBody.byteLength > 256 * 1024) {
      return NextResponse.json({ error: 'Invalid webhook request' }, { status: 413 })
    }
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
    signatureVerified = true

    const { data: claim, error: claimError } = await supaAdmin.rpc('claim_stripe_webhook_event', {
      p_event_id: event.id, p_event_type: event.type, p_stale_after: '5 minutes',
    })
    if (claimError || claim === 'conflict') {
      securityError('stripe_webhook_ledger_failed', { eventId: event.id, eventType: event.type })
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
    if (claim === 'duplicate' || claim === 'busy') {
      securityLog('stripe_webhook_duplicate', { eventId: event.id, eventType: event.type })
      return NextResponse.json({ received: true })
    }

    if (event.type === 'setup_intent.succeeded') {
      const setupIntent = event.data.object as Stripe.SetupIntent
      const orderId = OrderId.safeParse(setupIntent.metadata?.order_id)
      const paymentMethod =
        typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id
      const customer =
        typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id

      if (!orderId.success || !paymentMethod || !customer) {
        securityError('stripe_webhook_binding_failed', { eventId: event.id, eventType: event.type, reason: 'missing_binding' })
        await supaAdmin.from('stripe_webhook_events').update({ status: 'failed', result_code: 'missing_binding' }).eq('stripe_event_id', event.id)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
      }

      const { data: order, error: orderError } = await supaAdmin
        .from('orders')
        .select('id')
        .eq('id', orderId.data)
        .eq('stripe_customer_id', customer)
        .eq('stripe_setup_intent_id', setupIntent.id)
        .single()
      if (orderError || !order) {
        securityError('stripe_webhook_binding_failed', { eventId: event.id, eventType: event.type, reason: 'binding_mismatch' })
        await supaAdmin.from('stripe_webhook_events').update({ status: 'failed', result_code: 'binding_mismatch' }).eq('stripe_event_id', event.id)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
      }

      const { data: updated, error: updateError } = await supaAdmin
        .from('scheduled_payments')
        .update({ payment_method_id: paymentMethod })
        .eq('order_id', order.id)
        .eq('payment_method_id', 'pm_pending')
        .select('id')
        .maybeSingle()
      let scheduleApplied = Boolean(updated)
      if (!updateError && !updated) {
        const { data: existingSchedule } = await supaAdmin.from('scheduled_payments')
          .select('payment_method_id').eq('order_id', order.id).single()
        scheduleApplied = existingSchedule?.payment_method_id === paymentMethod
      }
      if (updateError || !scheduleApplied) {
        securityError('stripe_webhook_schedule_update_failed', { eventId: event.id, eventType: event.type })
        await supaAdmin.from('stripe_webhook_events').update({ status: 'failed', result_code: 'schedule_update_failed' }).eq('stripe_event_id', event.id)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
      }
    }

    const { data: completed, error: completionError } = await supaAdmin.from('stripe_webhook_events').update({
      status: 'processed', processed_at: new Date().toISOString(), result_code: 'ok',
    }).eq('stripe_event_id', event.id).eq('status', 'processing').select('stripe_event_id').maybeSingle()
    if (completionError || !completed) {
      securityError('stripe_webhook_ledger_completion_failed', { eventId: event.id, eventType: event.type })
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
  } catch {
    if (signatureVerified) {
      securityError('stripe_webhook_processing_failed')
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
    securityLog('stripe_webhook_rejected', { reason: 'invalid_request' })
    return NextResponse.json({ error: 'Invalid webhook request' }, { status: 400 })
  }
}
