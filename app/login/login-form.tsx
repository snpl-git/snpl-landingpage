'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import TurnstileChallenge from '@/components/turnstile-challenge'
import { getSupabaseClient } from '@/lib/supabase'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
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

  async function signInWithPasskey() {
    if (!captchaToken) {
      setError('Complete the security check first.')
      return
    }
    setPasskeyLoading(true)
    setError('')
    try {
      const { data, error: passkeyError } = await getSupabaseClient().auth.signInWithPasskey({
        options: { captchaToken },
      })
      if (passkeyError || !data.session) throw passkeyError || new Error('Passkey sign-in did not complete.')
      router.push('/account')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in with a passkey.')
    } finally {
      setCaptchaToken('')
      setCaptchaResetKey((value) => value + 1)
      setPasskeyLoading(false)
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault()
    if (!captchaToken) {
      setError('Complete the security check first.')
      return
    }
    const succeeded = await submit('/api/auth/email', { email, captchaToken })
    setCaptchaToken('')
    setCaptchaResetKey((value) => value + 1)
    if (succeeded) setSent(true)
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    if (await submit('/api/auth/verify', { email, token })) {
      router.push('/account/security')
      router.refresh()
    }
  }

  return <div className="mt-8">
    <button type="button" onClick={signInWithPasskey} disabled={passkeyLoading || loading}
      className="w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50">
      {passkeyLoading ? 'Waiting for passkey…' : 'Sign in with passkey'}
    </button>
    <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200" /><span className="text-xs font-medium uppercase tracking-wider text-slate-400">or use email</span><span className="h-px flex-1 bg-slate-200" /></div>
    <form onSubmit={sent ? verifyCode : sendCode} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
        <input id="email" type="email" autoComplete="email" required disabled={sent}
          placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50" />
      </div>
      {!sent ? <TurnstileChallenge onToken={receiveCaptchaToken} resetKey={captchaResetKey} /> : null}
      {sent ? <div>
        <label htmlFor="token" className="block text-sm font-medium text-slate-700">Six-digit email code</label>
        <input id="token" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}"
          value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-[0.3em] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200" />
        <p className="mt-2 text-sm text-slate-500">Check {email} for your verification code.</p>
      </div> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <button disabled={loading || passkeyLoading || (!sent && !captchaToken)} className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50">
        {loading ? 'Please wait…' : sent ? 'Verify email and continue' : 'Email me a code'}
      </button>
      {sent ? <button type="button" onClick={() => { setSent(false); setToken(''); setError('') }} className="w-full text-sm text-slate-600 hover:text-slate-900">Use a different email</button> : null}
    </form>
  </div>
}
