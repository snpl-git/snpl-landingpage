'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

export default function DemoPage() {
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [date, setDate] = useState<string>('')

  useEffect(() => {
    const supabase = getSupabaseClient()
    supabase.from('products').select('*').then(({ data, error }) => {
      if (error) console.error(error)
      setProducts(data || [])
    })
  }, [])

  const total = products.reduce((sum, p) => sum + (cart[p.id] || 0) * p.price_cents, 0)

  async function startCheckout() {
    const res = await fetch('/api/checkout/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: Object.entries(cart).map(([id, qty]) => ({ id, qty })),
        date,
      }),
    })
    const json = await res.json()
    if (json.clientSecret) {
      window.location.href = `/demo/confirm?cs=${encodeURIComponent(json.clientSecret)}&order=${json.orderId}`
    } else {
      alert(json.error || 'Failed to start checkout')
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Schedule a Purchase (Demo)</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="border rounded-xl p-4">
            <img src={p.image_url} alt={p.name} className="rounded mb-2" />
            <div className="font-medium">{p.name}</div>
            <div>${(p.price_cents / 100).toFixed(2)}</div>
            <div className="flex items-center gap-2 mt-2">
              <button className="px-3 py-1 border rounded"
                onClick={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}>
                -
              </button>
              <span>{cart[p.id] || 0}</span>
              <button className="px-3 py-1 border rounded"
                onClick={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border rounded-xl p-4">
        <div className="text-lg">Total: <strong>${(total / 100).toFixed(2)}</strong></div>
        <label className="block mt-3">
          Choose your payday:
          <input className="border rounded px-3 py-2 ml-2" type="date"
                 value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button disabled={!total || !date} onClick={startCheckout}
                className="mt-3 px-4 py-2 rounded bg-black text-white disabled:opacity-50">
          Authorize & Schedule
        </button>
      </div>
    </main>
  )
}
