import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const MAX_DISTINCT_ITEMS = 10
export const MAX_QUANTITY_PER_ITEM = 10
export const MAX_CART_QUANTITY = 25
export const MAX_CART_TOTAL_CENTS = 1_000_000
export const MAX_SCHEDULE_DAYS = 90

export function hashRequest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export const CHECKOUT_COOKIE = 'snpl_checkout'

function getCheckoutSecret() {
  const secret = process.env.CHECKOUT_SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('Checkout session secret is missing or too short')
  return secret
}

type CheckoutToken = { v: 1; oid: string; iat: number; exp: number; sv: number; n: string }

export function createCheckoutToken(orderId: string, sessionVersion = 1, now = Date.now()) {
  const issuedAt = Math.floor(now / 1000)
  const payload: CheckoutToken = {
    v: 1, oid: orderId, iat: issuedAt, exp: issuedAt + 30 * 60,
    sv: sessionVersion, n: randomBytes(16).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', getCheckoutSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function checkoutTokenForOrder(headers: Headers, orderId: string, now = Date.now()) {
  const cookie = headers.get('cookie')?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${CHECKOUT_COOKIE}=`))
  const token = cookie ? decodeURIComponent(cookie.slice(CHECKOUT_COOKIE.length + 1)) : ''
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encoded = '', signature = ''] = parts
  const expected = createHmac('sha256', getCheckoutSecret()).update(encoded).digest('base64url')
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CheckoutToken
    const current = Math.floor(now / 1000)
    if (payload.v !== 1 || payload.oid !== orderId || !Number.isInteger(payload.sv) || payload.sv < 1 ||
        !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
        payload.iat > current + 60 || payload.exp <= current || payload.exp - payload.iat !== 30 * 60 ||
        typeof payload.n !== 'string' || !/^[A-Za-z0-9_-]{20,32}$/.test(payload.n)) return null
    return payload
  } catch {
    return null
  }
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
