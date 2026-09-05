import AccountStatus from '@/components/account-status'
import { formatCurrency, formatDate } from '@/lib/account-format'
import { createAuthClient, requireUserId } from '@/lib/supabase-auth'

export default async function PurchaseHistoryPage() {
  const userId = await requireUserId()
  const supabase = await createAuthClient()
  const { data, error } = await supabase.from('orders').select('id,total_cents,status,created_at')
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return <section><h2 className="text-2xl font-semibold">Purchase history</h2><p className="mt-2 text-slate-600">Orders created while signed in to this account.</p>
    {!data?.length ? <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No order history yet.</p> : <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100">{data.map((order) => <article key={order.id} className="flex items-center justify-between gap-4 p-5"><div><p className="font-semibold">{formatCurrency(order.total_cents)}</p><p className="mt-1 text-sm text-slate-500">Ordered {formatDate(order.created_at)}</p></div><AccountStatus status={order.status} /></article>)}</div>
    </div>}
  </section>
}
