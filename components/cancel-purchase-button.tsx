'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelPurchaseButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function cancel() {
    if (!window.confirm('Cancel this scheduled purchase? This cannot be undone.')) return
    setLoading(true)
    setError('')
    const response = await fetch(`/api/account/scheduled/${encodeURIComponent(paymentId)}/cancel`, { method: 'POST' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) setError(result.error || 'Unable to cancel this purchase.')
    else router.refresh()
    setLoading(false)
  }

  return <div className="text-right">
    <button type="button" onClick={cancel} disabled={loading} className="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50">
      {loading ? 'Cancelling…' : 'Cancel purchase'}
    </button>
    {error ? <p role="alert" className="mt-1 text-xs text-red-700">{error}</p> : null}
  </div>
}
