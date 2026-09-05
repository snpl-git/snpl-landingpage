import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import { requireUserId } from '@/lib/supabase-auth'

const links = [
  ['/account', 'Overview'], ['/account/scheduled', 'Scheduled'],
  ['/account/history', 'History'], ['/account/payment-methods', 'Payment methods'],
  ['/account/security', 'Security'],
] as const

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUserId()
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <SiteHeader showDemoLink={false} />
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div><p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">SNPL Account</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your purchases</h1></div>
        <form action="/api/auth/signout" method="post"><button className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign out</button></form>
      </div>
      <nav aria-label="Account" className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200 pb-3">
        {links.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">{label}</Link>)}
      </nav>
      <main className="py-8">{children}</main>
    </div>
  </div>
}
