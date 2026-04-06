'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

type Product = {
  id: string
  name: string
  image_url?: string
  price_cents: number
  description?: string
}

export default function DemoPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [date, setDate] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase
      .from('products')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setProducts((data as Product[]) || [])
      })
  }, [])

  const total = useMemo(() => {
    return products.reduce((sum, p) => sum + (cart[p.id] || 0) * p.price_cents, 0)
  }, [products, cart])

  const itemCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  }, [cart])

  function decreaseQty(id: string) {
    setCart((current) => ({
      ...current,
      [id]: Math.max(0, (current[id] || 0) - 1),
    }))
  }

  function increaseQty(id: string) {
    setCart((current) => ({
      ...current,
      [id]: (current[id] || 0) + 1,
    }))
  }

  async function startCheckout() {
    try {
      setLoading(true)

      const res = await fetch('/api/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: Object.entries(cart)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => ({ id, qty })),
          date,
        }),
      })

      const json = await res.json()

      if (json.clientSecret) {
        window.location.href = `/demo/confirm?cs=${encodeURIComponent(json.clientSecret)}&order=${json.orderId}`
      } else {
        alert(json.error || 'Failed to start checkout')
      }
    } catch (error) {
      console.error(error)
      alert('Something went wrong starting checkout.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
            Interactive Demo
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            See how SNPL lets you buy now and pay on your schedule
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Pick a product, choose your payday, and experience how purchases can be planned
            around real cash flow.
          </p>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              How this demo works
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['1', 'Choose a product'],
              ['2', 'Select your quantity'],
              ['3', 'Pick your payday'],
              ['4', 'Authorize and schedule'],
            ].map(([step, text]) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {step}
                </div>
                <p className="text-sm font-medium text-slate-700">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_0.9fr]">
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Products</h2>
              <p className="text-sm text-slate-500">
                {products.length} item{products.length === 1 ? '' : 's'} available
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] bg-slate-100">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="mb-1 text-lg font-medium">{p.name}</div>
                    <p className="mb-4 text-sm leading-6 text-slate-500">
                      {p.description || 'Schedule this purchase for a date that works for you.'}
                    </p>

                    <div className="mb-4 text-xl font-semibold">
                      ${(p.price_cents / 100).toFixed(2)}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-2">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg transition hover:bg-slate-50"
                        onClick={() => decreaseQty(p.id)}
                      >
                        −
                      </button>

                      <span className="min-w-[2rem] text-center text-base font-medium">
                        {cart[p.id] || 0}
                      </span>

                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-lg transition hover:bg-slate-50"
                        onClick={() => increaseQty(p.id)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm lg:sticky lg:top-8">
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Purchase Summary
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Schedule this order
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Authorize your card now. You will only be charged on your selected date.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Items selected</span>
                <span>{itemCount}</span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-2xl font-semibold">
                  ${(total / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Choose your payday
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <button
              disabled={!total || !date || loading}
              onClick={startCheckout}
              className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Starting checkout...' : 'Authorize & Schedule'}
            </button>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Demo only. Save a payment method securely now and charge on the date you choose.
            </p>
          </aside>
        </div>
      </section>
    </main>
  )
}
