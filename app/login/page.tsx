import SiteHeader from '@/components/site-header'
import LoginForm from './login-form'

export default function LoginPage() {
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <SiteHeader showDemoLink={false} />
    <section className="mx-auto max-w-md px-6 py-20">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">SNPL Account</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in by phone</h1>
        <p className="mt-3 text-slate-600">We’ll text you a one-time code. No password needed.</p>
        <LoginForm />
      </div>
    </section>
  </main>
}
