import { getStripe } from '@/lib/stripe'
import { createAuthClient, requireUserId } from '@/lib/supabase-auth'

type SafeCard = { id: string; brand: string; last4: string; expMonth: number; expYear: number }

export default async function PaymentMethodsPage() {
  const userId = await requireUserId()
  const supabase = await createAuthClient()
  const { data, error } = await supabase.from('scheduled_payments')
    .select('payment_method_id,orders!inner(user_id,stripe_customer_id)').eq('orders.user_id', userId)
    .neq('payment_method_id', 'pm_pending')
  if (error) throw error

  const stripe = getStripe()
  const cards = (await Promise.all((data || []).map(async (row): Promise<SafeCard | null> => {
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
    if (!order?.stripe_customer_id) return null
    try {
      const method = await stripe.paymentMethods.retrieve(row.payment_method_id)
      const customerId = typeof method.customer === 'string' ? method.customer : method.customer?.id
      if (customerId !== order.stripe_customer_id || method.type !== 'card' || !method.card) return null
      return { id: method.id, brand: method.card.brand, last4: method.card.last4, expMonth: method.card.exp_month, expYear: method.card.exp_year }
    } catch { return null }
  }))).filter((card): card is SafeCard => Boolean(card))
  const uniqueCards = [...new Map(cards.map((card) => [card.id, card])).values()]

  return <section><h2 className="text-2xl font-semibold">Saved payment methods</h2><p className="mt-2 text-slate-600">Cards securely saved with Stripe for your scheduled purchases.</p>
    {!uniqueCards.length ? <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No saved payment methods to show.</p> : <div className="mt-6 grid gap-4 sm:grid-cols-2">{uniqueCards.map((card) => <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm font-medium uppercase tracking-wide text-slate-500">{card.brand}</p><p className="mt-3 text-lg font-semibold">•••• {card.last4}</p><p className="mt-2 text-sm text-slate-500">Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}</p></article>)}</div>}
    <p className="mt-6 text-sm text-slate-500">Adding and removing cards will be introduced after the charging model can support those changes safely.</p>
  </section>
}
