'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import SiteHeader from '@/components/site-header'

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

    const product = search.get('product') || ''
    const date = search.get('date') || ''

    if (orderId) url.searchParams.set('order', orderId)
    if (product) url.searchParams.set('product', product)
    if (date) url.searchParams.set('date', date)

    return url.toString()
  }, [orderId, search])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
    })

    setLoading(false)

    if (error) {
      alert(error.message)
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
            Interactive Demo
          </p>
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
            Step 2
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Authorize your card
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Confirm your purchase and save your payment method for the date you selected.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Confirm authorization
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Confirm your authorization to complete the scheduled purchase flow.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <PaymentElement />
              </div>

              <button
                type="submit"
                disabled={!stripe || loading}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Authorizing...' : 'Confirm Authorization'}
              </button>
            </form>
          </div>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Demo Card
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Demo card details
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use these details to complete the authorization.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Card number
                </p>
                <p className="mt-1 text-lg font-semibold tracking-wide">
                  4242 4242 4242 4242
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Expiration
                  </p>
                  <p className="mt-1 text-base font-medium">Any future date</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    CVC
                  </p>
                  <p className="mt-1 text-base font-medium">Any 3 digits</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  ZIP code
                </p>
                <p className="mt-1 text-base font-medium">Any 5 digits</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                What happens next
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Your card is saved securely</li>
                <li>• Your scheduled payment stays tied to your selected date</li>
                <li>• You are not charged today during authorization</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function ConfirmFormWithClientSecret() {
  const search = useSearchParams()
  const clientSecret = search.get('cs') || ''

  const options = useMemo(
    () =>
      ({
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#0f172a',
            colorText: '#0f172a',
            colorBackground: '#ffffff',
            colorDanger: '#dc2626',
            borderRadius: '12px',
          },
        },
      } as const),
    [clientSecret]
  )

  if (!clientSecret) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-6 py-20">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Missing session</h1>
            <p className="mt-3 text-slate-600">
              Start from the demo page and create a new authorization flow.
            </p>
            <a
              href="/demo"
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-800"
            >
              Back to Demo
            </a>
          </div>
        </section>
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
    <Suspense fallback={<div className="p-6 text-slate-600">Loading...</div>}>
      <ConfirmFormWithClientSecret />
    </Suspense>
  )
}    <main className="min-h-screen bg-white text-slate-900">
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
            Interactive Demo
          </p>
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
            Step 2
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Authorize your card
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Confirm your purchase and save your payment method for the date you selected.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Confirm authorization
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Confirm your authorization to complete the scheduled purchase flow.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <PaymentElement />
              </div>

              <button
                type="submit"
                disabled={!stripe || loading}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Authorizing...' : 'Confirm Authorization'}
              </button>
            </form>
          </div>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Demo Card
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Demo card details
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use these details to complete the authorization.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Card number
                </p>
                <p className="mt-1 text-lg font-semibold tracking-wide">
                  4242 4242 4242 4242
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Expiration
                  </p>
                  <p className="mt-1 text-base font-medium">Any future date</p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    CVC
                  </p>
                  <p className="mt-1 text-base font-medium">Any 3 digits</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  ZIP code
                </p>
                <p className="mt-1 text-base font-medium">Any 5 digits</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                What happens next
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Your card is saved securely</li>
                <li>• Your scheduled payment stays tied to your selected date</li>
                <li>• You are not charged today during authorization</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function ConfirmFormWithClientSecret() {
  const search = useSearchParams()
  const clientSecret = search.get('cs') || ''

  const options = useMemo(
    () =>
      ({
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#0f172a',
            colorText: '#0f172a',
            colorBackground: '#ffffff',
            colorDanger: '#dc2626',
            borderRadius: '12px',
          },
        },
      } as const),
    [clientSecret]
  )

  if (!clientSecret) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <section className="mx-auto max-w-3xl px-6 py-20">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Missing session</h1>
            <p className="mt-3 text-slate-600">
              Start from the demo page and create a new authorization flow.
            </p>
            <a
              href="/demo"
              className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-800"
            >
              Back to Demo
            </a>
          </div>
        </section>
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
    <Suspense fallback={<div className="p-6 text-slate-600">Loading...</div>}>
      <ConfirmFormWithClientSecret />
    </Suspense>
  )
}
