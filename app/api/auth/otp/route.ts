import { NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase-auth'
import { consumeRateLimit, RATE_LIMITS, trustedClientIp } from '@/lib/rate-limit'
import { readJsonBody, RequestBodyError } from '@/lib/request-security'
import { PhoneOtpRequestSchema, phoneOtpCredentials } from '@/lib/auth-input'

export async function POST(request: Request) {
  const limit = await consumeRateLimit(RATE_LIMITS.authOtpSend, trustedClientIp(request.headers))
  if (!limit.allowed) return NextResponse.json({ error: 'Please wait before requesting another code.' }, { status: limit.unavailable ? 503 : 429 })
  try {
    const parsed = PhoneOtpRequestSchema.safeParse(await readJsonBody(request, 4096))
    if (!parsed.success) return NextResponse.json({ error: 'Complete the security check and enter a valid phone number.' }, { status: 400 })
    const supabase = await createAuthClient()
    const { error } = await supabase.auth.signInWithOtp(phoneOtpCredentials(parsed.data))
    if (error) return NextResponse.json({ error: 'Unable to send a code right now.' }, { status: 400 })
    return NextResponse.json({ sent: true })
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 500
    return NextResponse.json({ error: 'Unable to send a code right now.' }, { status })
  }
}
