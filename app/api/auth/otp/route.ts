import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthClient } from '@/lib/supabase-auth'
import { consumeRateLimit, RATE_LIMITS, trustedClientIp } from '@/lib/rate-limit'
import { readJsonBody, RequestBodyError } from '@/lib/request-security'

const Body = z.object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/) }).strict()

export async function POST(request: Request) {
  const limit = await consumeRateLimit(RATE_LIMITS.authOtpSend, trustedClientIp(request.headers))
  if (!limit.allowed) return NextResponse.json({ error: 'Please wait before requesting another code.' }, { status: limit.unavailable ? 503 : 429 })
  try {
    const parsed = Body.safeParse(await readJsonBody(request, 1024))
    if (!parsed.success) return NextResponse.json({ error: 'Enter a phone number with country code.' }, { status: 400 })
    const supabase = await createAuthClient()
    const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone })
    if (error) return NextResponse.json({ error: 'Unable to send a code right now.' }, { status: 400 })
    return NextResponse.json({ sent: true })
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 500
    return NextResponse.json({ error: 'Unable to send a code right now.' }, { status })
  }
}
