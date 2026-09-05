export default function AccountLoading() {
  return <div className="grid gap-4 sm:grid-cols-3" aria-label="Loading account">
    {[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}
  </div>
}
