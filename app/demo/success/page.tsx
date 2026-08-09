'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SiteHeader from '@/components/site-header'

type VerifiedOrder = {
  authorized: true
  orderId: string
  amount: number
  currency: string
  date: string
  status: string
}

function SuccessContent() {
  const orderId = useSearchParams().get('order') || ''
  const [order, setOrder] = useState<VerifiedOrder | null>(null)
  const [state, setState] = useState<'loading' | 'processing' | 'error'>('loading')

  useEffect(() => {
    if (!orderId) {
      setState('error')
      return
    }

    let cancelled = false
    let attempts = 0
    const verify = async () => {
      attempts += 1
      try {
        const response = await fetch(`/api/checkout/status?order=${encodeURIComponent(orderId)}`, { cache: 'no-store' })
        const body = await response.json()
        if (cancelled) return
        if (response.ok && body.authorized) {
          setOrder(body)
          return
        }
        if (response.status === 202 && attempts < 6) {
          setState('processing')
          window.setTimeout(verify, 1000)
          return
        }
        setState('error')
      } catch {
        if (!cancelled) setState('error')
      }
    }
    verify()
    return () => { cancelled = true }
  }, [orderId])

  const formattedDate = order
    ? new Date(`${order.date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : ''
  const formattedAmount = order
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.amount / 100)
    : ''
  const calendarUrl = useMemo(() => {
    if (!order) return '#'
    const date = order.date.replaceAll('-', '')
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Scheduled SNPL Payment',
      dates: `${date}/${date}`,
      details: `Your ${formattedAmount} SNPL payment is scheduled for ${formattedDate}.`,
    })
    return `https://www.google.com/calendar/render?${params}`
  }, [formattedAmount, formattedDate, order])

  if (!order) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-2xl font-semibold">{state === 'error' ? 'Unable to verify authorization' : 'Verifying authorization…'}</h1>
          <p className="mt-3 text-slate-600">
            {state === 'error' ? 'Return to the demo and start a new checkout.' : 'We are confirming the trusted payment and order records.'}
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">Authorization Confirmed</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Purchase scheduled</h1>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-center text-2xl font-semibold">Verified confirmation details</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Detail label="Amount" value={formattedAmount} />
            <Detail label="Status" value="Authorized" />
            <Detail label="Scheduled for" value={formattedDate} />
          </div>
          <div className="mt-8 flex justify-center">
            <a href={calendarUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 bg-white px-5 py-3">Add to calendar</a>
          </div>
        </div>
      </section>
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 font-medium">{value}</p></div>
}

export default function SuccessPage() {
  return <Suspense fallback={<div className="p-6 text-slate-600">Loading…</div>}><SuccessContent /></Suspense>
}
