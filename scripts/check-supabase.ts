import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

async function hit(path: string, method: "GET" | "HEAD" = "GET") {
  const url = `${SUPABASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  if (SUPABASE_SERVICE_ROLE_KEY) {
    headers.apikey = SUPABASE_SERVICE_ROLE_KEY;
  }

  const response = await fetch(url, {
    method,
    headers,
  });

  const text = method === "HEAD" ? "" : await response.text();

  console.log("\n==", method, path, "==");
  console.log("status:", response.status, response.statusText);
  console.log("content-type:", response.headers.get("content-type"));
  if (text) {
    console.log("body-preview:", text.slice(0, 500));
  }
}

async function main() {
  await hit("/rest/v1/", "GET");
  await hit("/rest/v1/standings_cache?select=id&limit=1", "GET");
  await hit("/rest/v1/matches?select=id&limit=1", "GET");
}

main().catch((error) => {
  console.error("check-supabase failed", error);
  process.exit(1);
});
