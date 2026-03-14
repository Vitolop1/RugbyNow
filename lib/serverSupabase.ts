import { createClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readRuntimeEnv as readProcessRuntimeEnv, sanitizeRuntimeEnv } from "@/lib/runtimeEnv";

function readRuntimeEnv(name: string) {
  const processValue = readProcessRuntimeEnv(name);
  if (processValue) return processValue;

  try {
    const { env } = getCloudflareContext();
    const workerValue = (env as Record<string, unknown>)[name];
    if (typeof workerValue === "string" && workerValue.length > 0) {
      return sanitizeRuntimeEnv(name, workerValue);
    }
  } catch {
    // No Cloudflare request context available here; fall back to process.env only.
  }

  return undefined;
}

export function getServerSupabase() {
  const supabaseUrl = readRuntimeEnv("SUPABASE_URL") || readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") || readRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase server env vars");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}
