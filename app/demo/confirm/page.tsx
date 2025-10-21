'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

// Force dynamic rendering so Next/Vercel won't try to prerender this page
export const dynamic = 'force-dynamic'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function ConfirmFormInner() {
  const stripe = useStripe()
  const elements = useElements()
  const search = useSearchParams()
  const orderId = search.get('order') || ''
  const [loading, setLoading] = useState(false)

  const returnUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const url = new URL('/demo/success', base)
    if (orderId) url.searchParams.set('order', orderId)
    return url.toString()
  }, [orderId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
    })
    setLoading(false)
    if (error) alert(error.message)
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Authorize your card</h1>
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || loading}
        className="mt-3 px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? 'Authorizing…' : 'Confirm Authorization'}
      </button>
    </form>
  )
}

function ConfirmFormWithClientSecret() {
  const search = useSearchParams()
  const clientSecret = search.get('cs') || ''

  const options = useMemo(
    () => ({ clientSecret, appearance: { theme: 'flat' } } as const),
    [clientSecret]
  )

  if (!clientSecret) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="text-red-600">Missing client secret. Start from /demo again.</p>
      </main>
    )
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <ConfirmFormInner />
    </Elements>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <ConfirmFormWithClientSecret />
    </Suspense>
  )
}