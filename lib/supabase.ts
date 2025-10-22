// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  if (!url || !anon) {
    // Helpful dev guard; won't run until called in the browser
    throw new Error('Missing Supabase env vars (URL or ANON KEY).')
  }
  return createClient(url, anon)
}
