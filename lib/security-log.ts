type SecurityValue = string | number | boolean | null | undefined

const SAFE_KEYS = new Set([
  'route', 'reason', 'status', 'code', 'limit', 'retryAfterSeconds',
  'orderId', 'requestId', 'eventId', 'eventType', 'scheduledPaymentId',
])

export function securityLog(event: string, values: Record<string, SecurityValue> = {}) {
  const safe = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => SAFE_KEYS.has(key) && value !== undefined)
  )
  console.info(JSON.stringify({ kind: 'snpl_security', event, at: new Date().toISOString(), ...safe }))
}

export function securityError(event: string, values: Record<string, SecurityValue> = {}) {
  const safe = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => SAFE_KEYS.has(key) && value !== undefined)
  )
  console.error(JSON.stringify({ kind: 'snpl_security', event, at: new Date().toISOString(), ...safe }))
}
