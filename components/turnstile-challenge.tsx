'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export default function TurnstileChallenge({ onToken, resetKey }: { onToken: (token: string) => void; resetKey: number }) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const clearToken = useCallback(() => onToken(''), [onToken])

  useEffect(() => {
    if (!ready || !siteKey || !container.current || !window.turnstile) return
    if (widgetId.current) window.turnstile.remove(widgetId.current)
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      callback: onToken,
      'expired-callback': clearToken,
      'error-callback': clearToken,
    })
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [clearToken, onToken, ready, resetKey, siteKey])

  if (!siteKey) return <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Security challenge is not configured.</p>
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setReady(true)} />
    <div ref={container} aria-label="Security check" />
  </>
}
