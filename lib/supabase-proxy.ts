import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { shouldRedirectAccountRequest } from '@/lib/account-auth'

export async function refreshAuth(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data } = await supabase.auth.getClaims()

  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (shouldRedirectAccountRequest(request.nextUrl.pathname, userId)) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(login)
  }
  if (request.nextUrl.pathname === '/login' && userId) {
    const account = request.nextUrl.clone()
    account.pathname = '/account'
    account.search = ''
    return NextResponse.redirect(account)
  }
  return response
}
