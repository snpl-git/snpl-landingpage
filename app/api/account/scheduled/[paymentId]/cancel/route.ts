import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { getVerifiedUserId } from '@/lib/supabase-auth'

const PaymentId = z.string().uuid()

export async function POST(_request: Request, context: { params: Promise<{ paymentId: string }> }) {
  const userId = await getVerifiedUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const paymentId = PaymentId.safeParse((await context.params).paymentId)
  if (!paymentId.success) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })

  const { data, error } = await getCheckoutAdmin().rpc('cancel_owned_scheduled_purchase', {
    p_scheduled_payment_id: paymentId.data,
    p_user_id: userId,
  })
  if (error) return NextResponse.json({ error: 'Unable to cancel this purchase' }, { status: 500 })
  if (data === 'not_found') return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  if (data !== 'cancelled' && data !== 'already_cancelled') {
    return NextResponse.json({ error: 'This purchase can no longer be cancelled' }, { status: 409 })
  }
  return NextResponse.json({ cancelled: true })
}
