const styles: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700', processing: 'bg-amber-50 text-amber-700',
  charged: 'bg-emerald-50 text-emerald-700', failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
}

export default function AccountStatus({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${styles[status] || styles.cancelled}`}>{status}</span>
}
