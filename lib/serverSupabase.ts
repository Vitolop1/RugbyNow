import { createClient } from "@supabase/supabase-js";

// Local workaround for intercepted TLS/corporate filtering during development.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase server env vars");
}

export const serverSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
