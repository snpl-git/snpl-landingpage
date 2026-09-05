import AccountStatus from '@/components/account-status'
import CancelPurchaseButton from '@/components/cancel-purchase-button'
import { canCancelScheduledPayment } from '@/lib/account-security'
import { formatCurrency, formatDate } from '@/lib/account-format'
import { createAuthClient, requireUserId } from '@/lib/supabase-auth'

export default async function ScheduledPurchasesPage() {
  const userId = await requireUserId()
  const supabase = await createAuthClient()
  const { data, error } = await supabase.from('scheduled_payments')
    .select('id,amount,currency,run_at_date,status,processing_at,orders!inner(id,user_id,status)')
    .eq('orders.user_id', userId).order('run_at_date', { ascending: true })
  if (error) throw error

  return <section><h2 className="text-2xl font-semibold">Scheduled purchases</h2><p className="mt-2 text-slate-600">Upcoming and completed scheduled payments.</p>
    {!data?.length ? <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">You don’t have any scheduled purchases.</p> :
      <div className="mt-6 space-y-4">{data.map((payment) => <article key={payment.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-3"><p className="text-lg font-semibold">{formatCurrency(payment.amount, payment.currency)}</p><AccountStatus status={payment.status} /></div><p className="mt-2 text-sm text-slate-500">Scheduled for {formatDate(payment.run_at_date)}</p></div>
        {canCancelScheduledPayment(payment.status, payment.processing_at) ? <CancelPurchaseButton paymentId={payment.id} /> : null}
      </article>)}</div>}
  </section>
}
