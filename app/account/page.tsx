import Link from 'next/link'
import { createAuthClient, requireUserId } from '@/lib/supabase-auth'
import { formatCurrency, formatDate } from '@/lib/account-format'

export default async function AccountOverviewPage() {
  const userId = await requireUserId()
  const supabase = await createAuthClient()
  const [accountResult, recentOrdersResult, scheduledCountResult] = await Promise.all([
    supabase.from('accounts').select('display_name').eq('id', userId).maybeSingle(),
    supabase.from('orders').select('id,total_cents,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'scheduled'),
  ])
  const error = accountResult.error || recentOrdersResult.error || scheduledCountResult.error
  if (error) throw error
  const account = accountResult.data
  const orders = recentOrdersResult.data
  const scheduled = scheduledCountResult.count ?? 0
  return <div className="space-y-8">
    <div><h2 className="text-2xl font-semibold">Welcome{account?.display_name ? `, ${account.display_name}` : ''}</h2><p className="mt-2 text-slate-600">See what’s scheduled and review your recent purchases.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <Link href="/account/scheduled" className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Scheduled purchases</p><p className="mt-2 text-3xl font-semibold">{scheduled}</p></Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Recent orders</p><p className="mt-2 text-3xl font-semibold">{orders?.length || 0}</p></div>
      <Link href="/account/payment-methods" className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">Payment methods</p><p className="mt-3 font-medium">View saved cards →</p></Link>
    </div>
    <section><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent activity</h2><Link href="/account/history" className="text-sm font-medium text-slate-600">View all</Link></div>
      {!orders?.length ? <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No purchases yet.</p> : <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">{orders.map((order) => <div key={order.id} className="flex items-center justify-between p-5"><div><p className="font-medium">{formatCurrency(order.total_cents)}</p><p className="mt-1 text-sm text-slate-500">{formatDate(order.created_at)}</p></div><span className="capitalize text-sm text-slate-600">{order.status}</span></div>)}</div>}
    </section>
  </div>
}
