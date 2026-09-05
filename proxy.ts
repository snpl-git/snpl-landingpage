import type { NextRequest } from 'next/server'
import { refreshAuth } from '@/lib/supabase-proxy'

export function proxy(request: NextRequest) {
  return refreshAuth(request)
}

export const config = {
  matcher: ['/account/:path*', '/login'],
}
