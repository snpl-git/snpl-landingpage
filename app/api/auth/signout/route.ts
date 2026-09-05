import { NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase-auth'

export async function POST(request: Request) {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), 303)
}
