'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import SiteHeader from '@/components/site-header'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function ConfirmForm({ orderId }: { orderId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)

    const result = await stripe.confirmSetup({ elements, redirect: 'if_required' })
    if (result.error) {
      setLoading(false)
      alert(result.error.message || 'Authorization failed')
      return
    }

    router.replace(`/demo/success?order=${encodeURIComponent(orderId)}`)
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Interactive Demo · Step 2</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Authorize your card</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">Securely save your payment method for the scheduled purchase.</p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-semibold tracking-tight">Confirm authorization</h2>
            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><PaymentElement /></div>
              <button type="submit" disabled={!stripe || loading} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white disabled:opacity-40">
                {loading ? 'Authorizing...' : 'Confirm Authorization'}
              </button>
            </form>
          </div>
          <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Demo Card</p>
            <p className="mt-3 text-lg font-semibold tracking-wide">4242 4242 4242 4242</p>
            <p className="mt-2 text-sm text-slate-600">Expiration 12 / 34 · CVC 123 · ZIP 12345</p>
          </aside>
        </div>
      </section>
    </main>
  )
}

function ConfirmContent() {
  const orderId = useSearchParams().get('order') || ''
  const [clientSecret, setClientSecret] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) return
    fetch(`/api/checkout/session?order=${encodeURIComponent(orderId)}`, { cache: 'no-store' })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => {
        if (!ok || !body.clientSecret) throw new Error('Session unavailable')
        setClientSecret(body.clientSecret)
      })
      .catch(() => setError('This checkout session is missing or no longer available.'))
  }, [orderId])

  const options = useMemo(() => ({ clientSecret, appearance: { theme: 'flat' as const } }), [clientSecret])
  if (!orderId || error) return <div className="p-10 text-center text-slate-600">{error || 'Missing checkout session.'}</div>
  if (!clientSecret) return <div className="p-10 text-center text-slate-600">Loading secure checkout…</div>
  return <Elements stripe={stripePromise} options={options}><ConfirmForm orderId={orderId} /></Elements>
}

export default function ConfirmPage() {
  return <Suspense fallback={<div className="p-6 text-slate-600">Loading…</div>}><ConfirmContent /></Suspense>
}
