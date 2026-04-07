'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import SiteHeader from '@/components/site-header'

type Product = {
  id: string
  name: string
  image_url?: string
  price_cents: number
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
    return products.reduce((sum, p) => {
      return sum + (cart[p.id] || 0) * p.price_cents
    }, 0)
  }, [products, cart])

  const itemCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  }, [cart])

  const selectedItems = useMemo(() => {
    return products
      .filter((p) => (cart[p.id] || 0) > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        qty: cart[p.id] || 0,
        subtotal: (cart[p.id] || 0) * p.price_cents,
      }))
  }, [products, cart])

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

      const primaryProduct = selectedItems[0]?.name || 'Your purchase'

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
      <SiteHeader />

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-300">
            Interactive Demo
          </p>
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
            Step 1
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Schedule your purchase
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Choose a product, pick your payday, and continue to authorization.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Pick a product, choose your date, then continue to authorization.
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.5fr_0.9fr]">
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Products</h2>
              <span className="text-sm text-slate-500">
                {products.length} available
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => {
                const isSelected = (cart[p.id] || 0) > 0

                return (
                  <div
                    key={p.id}
                    className={`overflow-hidden rounded-2xl border bg-white transition duration-150 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
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

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {isSelected && (
                            <p className="mt-1 text-xs text-slate-500">
                              Added to schedule
                            </p>
                          )}
                        </div>

                        {isSelected && (
                          <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
                            Selected
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        ${(p.price_cents / 100).toFixed(2)}
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => decreaseQty(p.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-slate-200"
                          >
                            −
                          </button>

                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={cart[p.id] || 0}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0)
                              setCart((c) => ({ ...c, [p.id]: val }))
                            }}
                            className="w-14 text-center font-medium border border-transparent rounded focus:border-slate-300 focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => increaseQty(p.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 active:bg-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6 lg:sticky lg:top-8">
            <h2 className="text-xl font-semibold">Summary</h2>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Items</span>
                <span>{itemCount}</span>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span>Total</span>
                <span className="text-lg font-semibold text-slate-900">
                  ${(total / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">Selected items</p>

              {selectedItems.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No products selected yet.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Qty {item.qty}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        ${(item.subtotal / 100).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <label className="text-sm text-slate-600">
                Choose your payday
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <button
              disabled={!total || !date || loading}
              onClick={startCheckout}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-white hover:bg-slate-800 disabled:opacity-40"
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
