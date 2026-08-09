import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { getCheckoutAdmin } from '@/lib/checkout-admin'
import { securityError, securityLog } from '@/lib/security-log'

export type RateLimitPolicy = { name: string; limit: number; windowSeconds: number }
export const RATE_LIMITS = {
  checkoutStart: { name: 'checkout-start', limit: 8, windowSeconds: 600 },
  checkoutSession: { name: 'checkout-session', limit: 60, windowSeconds: 600 },
  checkoutSessionToken: { name: 'checkout-session-token', limit: 30, windowSeconds: 600 },
  checkoutStatus: { name: 'checkout-status', limit: 60, windowSeconds: 600 },
  checkoutStatusToken: { name: 'checkout-status-token', limit: 60, windowSeconds: 600 },
  subscribe: { name: 'subscribe', limit: 5, windowSeconds: 3600 },
} satisfies Record<string, RateLimitPolicy>

type Entry = { count: number; expiresAt: number }
const local = new Map<string, Entry>()

function normalizeIp(raw: string) {
  const value = raw.trim().replace(/^\[|\]$/g, '')
  if (isIP(value) === 4) return value
  if (isIP(value) === 6) {
    // Group IPv6 clients by the commonly assigned /64 to avoid trivial address rotation.
    const [left, right = ''] = value.toLowerCase().split('::')
    const lhs = left ? left.split(':') : []
    const rhs = right ? right.split(':') : []
    const expanded = [...lhs, ...Array(Math.max(0, 8 - lhs.length - rhs.length)).fill('0'), ...rhs]
      .map((part) => part.padStart(4, '0'))
    return `${expanded.slice(0, 4).join(':')}::/64`
  }
  return 'unknown'
}

export function trustedClientIp(headers: Headers) {
  const vercel = headers.get('x-vercel-forwarded-for')?.split(',')[0]
  if (vercel) return normalizeIp(vercel)
  if (process.env.NODE_ENV !== 'production') {
    const localAddress = headers.get('x-forwarded-for')?.split(',')[0] ?? headers.get('x-real-ip')
    if (localAddress) return normalizeIp(localAddress)
  }
  return 'unknown'
}

function rateKey(policy: RateLimitPolicy, identity: string) {
  const secret = process.env.CHECKOUT_SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Rate-limit key secret is unavailable')
  return createHmac('sha256', secret).update(`${policy.name}:${identity}`).digest('hex')
}

function localConsume(key: string, policy: RateLimitPolicy) {
  const now = Date.now()
  const current = local.get(key)
  if (!current || current.expiresAt <= now) {
    local.set(key, { count: 1, expiresAt: now + policy.windowSeconds * 1000 })
    return { allowed: true, remaining: policy.limit - 1, retryAfterSeconds: 0, distributed: false }
  }
  current.count++
  return {
    allowed: current.count <= policy.limit,
    remaining: Math.max(policy.limit - current.count, 0),
    retryAfterSeconds: current.count <= policy.limit ? 0 : Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    distributed: false,
  }
}

export async function consumeRateLimit(policy: RateLimitPolicy, identity: string) {
  const key = rateKey(policy, identity)
  try {
    const { data, error } = await getCheckoutAdmin().rpc('consume_api_rate_limit', {
      p_key_hash: key, p_limit: policy.limit, p_window_seconds: policy.windowSeconds,
    })
    if (error || !data?.[0]) throw new Error('Distributed rate limit unavailable')
    const result = { ...data[0], distributed: true }
    if (!result.allowed) securityLog('rate_limit_blocked', { route: policy.name, retryAfterSeconds: result.retry_after_seconds })
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterSeconds: result.retry_after_seconds,
      distributed: true,
    }
  } catch {
    if (process.env.NODE_ENV === 'production') {
      securityError('rate_limit_unavailable', { route: policy.name })
      return { allowed: false, remaining: 0, retryAfterSeconds: 60, distributed: false, unavailable: true }
    }
    return localConsume(key, policy)
  }
}
