'use client'

import { FormEvent, useState } from 'react'

export function WaitlistForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const payload = {
      firstName: String(formData.get('firstName') || ''),
      email: String(formData.get('email') || ''),
      interest: String(formData.get('interest') || ''),
    }

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Something went wrong')
      }

      event.currentTarget.reset()
      setMessage('You are on the list. We will keep you posted as SNPL grows.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[1.75rem] bg-neutral-50 p-6 ring-1 ring-black/5 md:p-8">
      <div className="space-y-5">
        <div>
          <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-neutral-700">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
            placeholder="Joe"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="interest" className="mb-2 block text-sm font-medium text-neutral-700">
            What are you most interested in?
          </label>
          <select
            id="interest"
            name="interest"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
            defaultValue="General access"
          >
            <option>General access</option>
            <option>Using SNPL personally</option>
            <option>Merchant or partner interest</option>
            <option>Product updates</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Joining...' : 'Join early access'}
      </button>

      {message ? <p className="mt-4 text-sm leading-6 text-neutral-600">{message}</p> : null}
      {error ? <p className="mt-4 text-sm leading-6 text-red-600">{error}</p> : null}
    </form>
  )
}
