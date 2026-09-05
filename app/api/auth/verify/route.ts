import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthClient } from '@/lib/supabase-auth'
import { consumeRateLimit, RATE_LIMITS, trustedClientIp } from '@/lib/rate-limit'
import { readJsonBody, RequestBodyError } from '@/lib/request-security'

const Body = z.object({
  email: z.string().trim().email().max(254),
  token: z.string().regex(/^\d{6}$/),
}).strict()

export async function POST(request: Request) {
  const limit = await consumeRateLimit(RATE_LIMITS.authEmailVerify, trustedClientIp(request.headers))
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait and try again.' }, { status: limit.unavailable ? 503 : 429 })
  try {
    const parsed = Body.safeParse(await readJsonBody(request, 1024))
    if (!parsed.success) return NextResponse.json({ error: 'Enter the six-digit code.' }, { status: 400 })
    const supabase = await createAuthClient()
    const { data, error } = await supabase.auth.verifyOtp({ ...parsed.data, type: 'email' })
    if (error || !data.user) return NextResponse.json({ error: 'That code is invalid or expired.' }, { status: 400 })

    const { error: accountError } = await supabase.from('accounts').upsert({ id: data.user.id }, { onConflict: 'id' })
    if (accountError) return NextResponse.json({ error: 'Unable to initialize your account.' }, { status: 500 })
    return NextResponse.json({ verified: true })
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 500
    return NextResponse.json({ error: 'Unable to verify the code right now.' }, { status })
  }
}
