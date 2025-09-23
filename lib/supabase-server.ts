import { createClient } from "@supabase/supabase-js";

export function getAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE!;
  if (!url || !serviceKey) throw new Error("Supabase server env vars not set");
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
