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
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-gray-500">
            Interactive Demo
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Schedule a purchase around your payday
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-600">
            Pick a product, choose your date, and see how SNPL lets you plan purchases
            around your real cash flow.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.5fr_0.9fr]">
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Products</h2>
              <p className="text-sm text-gray-500">
                {products.length} item{products.length === 1 ? '' : 's'} available
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="aspect-[4/3] bg-gray-100">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="mb-1 text-lg font-medium">{p.name}</div>
                    {p.description ? (
                      <p className="mb-4 text-sm leading-6 text-gray-500">
                        {p.description}
                      </p>
                    ) : (
                      <p className="mb-4 text-sm leading-6 text-gray-500">
                        Schedule this purchase for a date that works for you.
                      </p>
                    )}

                    <div className="mb-4 text-xl font-semibold">
                      ${(p.price_cents / 100).toFixed(2)}
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-gray-200 p-2">
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-lg transition hover:bg-gray-50"
                        onClick={() => decreaseQty(p.id)}
                      >
                        −
                      </button>

                      <span className="min-w-[2rem] text-center text-base font-medium">
                        {cart[p.id] || 0}
                      </span>

                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-lg transition hover:bg-gray-50"
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

          <aside className="h-fit rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm lg:sticky lg:top-8">
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-gray-500">
                Purchase Summary
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Schedule this order
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Authorize your card now. You will only be charged on your selected date.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Items selected</span>
                <span>{itemCount}</span>
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-2xl font-semibold">
                  ${(total / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Choose your payday
              </label>
              <input
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-black"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <button
              disabled={!total || !date || loading}
              onClick={startCheckout}
              className="mt-6 w-full rounded-xl bg-black px-4 py-3 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Starting checkout...' : 'Authorize & Schedule'}
            </button>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Demo only. Your payment method is securely authorized and your purchase is
              scheduled for the date you choose.
            </p>
          </aside>
        </div>
      </section>
    </main>
  )
}
