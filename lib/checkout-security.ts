import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const MAX_DISTINCT_ITEMS = 10
export const MAX_QUANTITY_PER_ITEM = 10
export const MAX_CART_QUANTITY = 25
export const MAX_CART_TOTAL_CENTS = 1_000_000
export const MAX_SCHEDULE_DAYS = 90

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_REQUESTS = 10

type RateLimitEntry = { count: number; resetAt: number }

const globalRateLimits = globalThis as typeof globalThis & {
  snplRateLimits?: Map<string, RateLimitEntry>
}

const rateLimits = globalRateLimits.snplRateLimits ?? new Map<string, RateLimitEntry>()
globalRateLimits.snplRateLimits = rateLimits

export function getClientAddress(headers: Headers) {
  return (
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

export function consumeCheckoutRateLimit(key: string, now = Date.now()) {
  const current = rateLimits.get(key)

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (current.count >= RATE_LIMIT_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function hashRequest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export const CHECKOUT_COOKIE = 'snpl_checkout'

function getCheckoutSecret() {
  const secret = process.env.CHECKOUT_SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Checkout session secret is missing or too short')
  return secret
}

export function createCheckoutToken(orderId: string) {
  const signature = createHmac('sha256', getCheckoutSecret()).update(orderId).digest('base64url')
  return `${orderId}.${signature}`
}

export function requestOwnsOrder(headers: Headers, orderId: string) {
  const cookie = headers.get('cookie')?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${CHECKOUT_COOKIE}=`))
  const token = cookie ? decodeURIComponent(cookie.slice(CHECKOUT_COOKIE.length + 1)) : ''
  const expected = createCheckoutToken(orderId)
  const actualBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export function parseScheduleDate(value: string, now = new Date()) {
  const [year, month, day] = value.split('-').map(Number)
  const selected = new Date(Date.UTC(year, month - 1, day))

  if (
    selected.getUTCFullYear() !== year ||
    selected.getUTCMonth() !== month - 1 ||
    selected.getUTCDate() !== day
  ) {
    return null
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const latest = new Date(today)
  latest.setUTCDate(latest.getUTCDate() + MAX_SCHEDULE_DAYS)

  return selected >= today && selected <= latest ? value : null
}
