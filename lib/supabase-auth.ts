import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase auth configuration is missing')
  return { url, key }
}

export async function createAuthClient() {
  const cookieStore = await cookies()
  const { url, key } = publicSupabaseConfig()

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot write cookies. proxy.ts performs refreshes.
        }
      },
    },
  })
}

export async function getVerifiedUserId() {
  const supabase = await createAuthClient()
  const { data, error } = await supabase.auth.getClaims()
  return error || typeof data?.claims?.sub !== 'string' ? null : data.claims.sub
}

export async function requireUserId() {
  const userId = await getVerifiedUserId()
  if (!userId) redirect('/login')
  return userId
}
