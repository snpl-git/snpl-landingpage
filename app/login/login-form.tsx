'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import TurnstileChallenge from '@/components/turnstile-challenge'

export default function LoginForm() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const receiveCaptchaToken = useCallback((value: string) => setCaptchaToken(value), [])

  async function submit(path: string, body: object) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Something went wrong.')
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault()
    if (!captchaToken) {
      setError('Complete the security check first.')
      return
    }
    const succeeded = await submit('/api/auth/otp', { phone, captchaToken })
    setCaptchaToken('')
    setCaptchaResetKey((value) => value + 1)
    if (succeeded) setSent(true)
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    if (await submit('/api/auth/verify', { phone, token })) {
      router.push('/account')
      router.refresh()
    }
  }

  return (
    <form onSubmit={sent ? verifyCode : sendCode} className="mt-8 space-y-5">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Mobile number</label>
        <input id="phone" type="tel" autoComplete="tel" required disabled={sent}
          placeholder="+1 555 123 4567" value={phone} onChange={(event) => setPhone(event.target.value.replace(/[\s()-]/g, ''))}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50" />
      </div>
      {!sent ? <TurnstileChallenge onToken={receiveCaptchaToken} resetKey={captchaResetKey} /> : null}
      {sent ? <div>
        <label htmlFor="token" className="block text-sm font-medium text-slate-700">Six-digit code</label>
        <input id="token" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}"
          value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-[0.3em] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
      </div> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <button disabled={loading || (!sent && !captchaToken)} className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {loading ? 'Please wait…' : sent ? 'Verify and sign in' : 'Text me a code'}
      </button>
      {sent ? <button type="button" onClick={() => { setSent(false); setToken(''); setError('') }} className="w-full text-sm text-slate-600 hover:text-slate-900">Use a different number</button> : null}
    </form>
  )
}
