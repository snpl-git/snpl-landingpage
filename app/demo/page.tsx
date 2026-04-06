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
    setCart((c) => ({
      ...c,
      [id]: Math.max(0, (c[id] || 0) - 1),
    }))
  }

  function increaseQty(id: string) {
    setCart((c) => ({
      ...c,
      [id]: (c[id] || 0) + 1,
    }))
  }

  async function startCheckout() {
    try {
      setLoading(true)

      const selectedProducts = products
        .filter((p) => (cart[p.id] || 0) > 0)
        .map((p) => p.name)

      const primaryProduct = selectedProducts[0] || 'Your purchase'

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
        const params = new URLSearchParams({
          cs: json.clientSecret,
          order: json.orderId,
          product: primaryProduct,
          date,
        })

        window.location.href = `/demo/confirm?${params.toString()}`
      } else {
        alert(json.error || 'Failed to start checkout')
      }
    } catch (err) {
      console.error(err)
      alert('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      
      {/* HEADER */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Schedule your purchase
          </h1>
          <p className="mt-3 text-slate-300">
            Choose a product, pick your payday, and authorize your card.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_0.9fr]">
          
          {/* PRODUCTS */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Products</h2>
              <span className="text-sm text-slate-500">
                {products.length} available
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition"
                >
                  <div className="aspect-[4/3] bg-slate-100">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="font-medium">{p.name}</div>

                    <div className="mt-1 text-slate-500 text-sm">
                      ${(p.price_cents / 100).toFixed(2)}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <button
                        className="w-9 h-9 border rounded-lg"
                        onClick={() => decreaseQty(p.id)}
                      >
                        −
                      </button>

                      <span className="font-medium">
                        {cart[p.id] || 0}
                      </span>

                      <button
                        className="w-9 h-9 border rounded-lg"
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

          {/* SUMMARY */}
          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              Summary
            </h2>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Items</span>
                <span>{itemCount}</span>
              </div>

              <div className="flex justify-between border-t pt-3">
                <span>Total</span>
                <span className="font-semibold text-lg">
                  ${(total / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-sm text-slate-600">
                Choose your payday
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full border rounded-lg px-3 py-2"
              />
            </div>

            <button
              disabled={!total || !date || loading}
              onClick={startCheckout}
              className="mt-6 w-full bg-slate-900 text-white py-3 rounded-lg disabled:opacity-40"
            >
              {loading ? 'Starting...' : 'Continue'}
            </button>

            <p className="mt-4 text-xs text-slate-500">
              You’ll authorize your card next. You are not charged today.
            </p>
          </aside>

        </div>
      </section>

    </main>
  )
}
