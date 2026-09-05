'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PasskeyListItem } from '@supabase/supabase-js'
import { canRegisterPasskey } from '@/lib/passkey-security'
import { getSupabaseClient } from '@/lib/supabase'

export default function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [registrationSucceeded, setRegistrationSucceeded] = useState(false)
  const [error, setError] = useState('')

  const loadPasskeys = useCallback(async () => {
    const { data, error: listError } = await getSupabaseClient().auth.passkey.list()
    if (listError) setError('Unable to load your passkeys.')
    else setPasskeys(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    getSupabaseClient().auth.passkey.list().then(({ data, error: listError }) => {
      if (!active) return
      if (listError) setError('Unable to load your passkeys.')
      else setPasskeys(data || [])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function register() {
    setRegistering(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { data: claimsData } = await supabase.auth.getClaims()
      const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
      if (!canRegisterPasskey(userId)) throw new Error('Sign in before registering a passkey.')
      const { error: registrationError } = await supabase.auth.registerPasskey()
      if (registrationError) throw registrationError
      setRegistrationSucceeded(true)
      await loadPasskeys()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register a passkey.')
    } finally {
      setRegistering(false)
    }
  }

  return <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h3 className="font-semibold">Your passkeys</h3><p className="mt-1 text-sm text-slate-500">Stored securely by your device or password manager.</p></div>
      <button type="button" onClick={register} disabled={registering || loading || registrationSucceeded || passkeys.length > 0} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{registering ? 'Registering…' : registrationSucceeded || passkeys.length > 0 ? 'Passkey added' : 'Add a passkey'}</button>
    </div>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    {loading ? <p className="mt-6 text-sm text-slate-500">Loading passkeys…</p> : passkeys.length === 0 ? <p className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No passkeys registered yet. Add one to make it your primary sign-in method.</p> : <ul className="mt-6 divide-y divide-slate-100">{passkeys.map((passkey) => <li key={passkey.id} className="py-4"><p className="font-medium">{passkey.friendly_name || 'Passkey'}</p><p className="mt-1 text-sm text-slate-500">Added {new Date(passkey.created_at).toLocaleDateString()}</p></li>)}</ul>}
    <p className="mt-5 text-xs leading-5 text-slate-500">Email remains available for account recovery. Passkey rename and deletion are not enabled in Account v1.</p>
  </div>
}
