'use client'

import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function ConfirmInner() {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!stripe || !elements) return
    setLoading(true)
    const { error } = await stripe.confirmSetup({ elements, confirmParams: {} })
    setLoading(false)
    if (error) {
      alert(error.message)
    } else {
      window.location.href = '/demo/success'
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-4">Authorize Your Payment Method</h1>
      <PaymentElement />
      <button
        onClick={handleSubmit}
        disabled={!stripe || loading}
        className="mt-4 px-4 py-2 bg-black text-white rounded"
      >
        {loading ? 'Processing…' : 'Confirm Authorization'}
      </button>
    </div>
  )
}

export default function ConfirmPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cs = params.get('cs')
    setClientSecret(cs)
  }, [])

  if (!clientSecret) return null

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <ConfirmInner />
    </Elements>
  )
}