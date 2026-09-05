import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string
  if (!url || !key) {
    throw new Error('Missing public Supabase environment variables.')
  }
  browserClient ??= createBrowserClient(url, key, {
    auth: { experimental: { passkey: true } },
  })
  return browserClient
}
