'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import SiteHeader from '@/components/site-header'

function SuccessContent() {
  const search = useSearchParams()
  const product = search.get('product') || 'Your purchase'
  const date = search.get('date') || ''

  const formattedDate = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'your selected date'

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
            Authorization Confirmed
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Purchase scheduled
          </h1>
          <p className="mt-4 mx-auto max-w-2xl text-lg leading-8 text-slate-300">
            Your payment method has been securely saved and this purchase is now scheduled.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-slate-900 bg-slate-900 text-2xl text-white">
              ✓
            </div>

            <h2 className="text-2xl font-semibold tracking-tight">
              Confirmation details
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600">
              Your authorization was successful. The purchase below is scheduled for the date you selected.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-500">Product</p>
              <p className="mt-2 font-medium text-slate-900">{product}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <p className="mt-2 font-medium text-slate-900">Authorized</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-sm font-medium text-slate-500">Scheduled for</p>
              <p className="mt-2 font-medium text-slate-900">{formattedDate}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8">
          <div className="mx-auto max-w-2xl">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              What happens next
            </h3>

            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <li>• Your payment method has been securely authorized</li>
              <li>• You were not charged today</li>
              <li>• Your purchase remains scheduled for your selected date</li>
            </ul>
          </div>
        </div>
<div className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-center">
  <div className="mx-auto max-w-2xl">
    <h3 className="text-2xl font-semibold tracking-tight">
      Want this for real purchases?
    </h3>

    <p className="mt-4 text-base leading-7 text-slate-600">
      Join the waitlist to get early access when SNPL launches, follow the build,
      and help shape what comes next.
    </p>

    <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
      <a
        href="/#waitlist"
        className="inline-flex rounded-xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-800"
      >
        Join the Waitlist
      </a>

      <a
        href="/demo"
        className="inline-flex rounded-xl border border-slate-300 px-6 py-3 text-slate-900 transition hover:bg-slate-50"
      >
        Back to Demo
      </a>
    </div>
  </div>
</div>
      </section>
    </main>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  )
}
