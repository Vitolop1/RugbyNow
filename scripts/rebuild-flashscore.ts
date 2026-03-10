import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.env.DRY_RUN === "1";
const CONFIRM_RESET = process.env.CONFIRM_RESET === "YES";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

if (!DRY_RUN && !CONFIRM_RESET) {
  throw new Error("Refusing to reset Flashscore data without CONFIRM_RESET=YES");
}

async function main() {
  if (DRY_RUN) {
    console.log("DRY_RUN=1 -> skip DB reset, running sync-flashscore only.");
  } else {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const [{ count: standingsCount, error: standingsCountError }, { count: matchesCount, error: matchesCountError }] =
      await Promise.all([
        supabase.from("standings_cache").select("*", { count: "exact", head: true }).eq("source", "flashscore"),
        supabase.from("matches").select("*", { count: "exact", head: true }).eq("source", "flashscore"),
      ]);

    if (standingsCountError) throw standingsCountError;
    if (matchesCountError) throw matchesCountError;

    console.log(`Resetting Flashscore data -> standings_cache=${standingsCount ?? 0}, matches=${matchesCount ?? 0}`);

    const { error: standingsDeleteError } = await supabase.from("standings_cache").delete().eq("source", "flashscore");
    if (standingsDeleteError) throw standingsDeleteError;

    const { error: matchesDeleteError } = await supabase.from("matches").delete().eq("source", "flashscore");
    if (matchesDeleteError) throw matchesDeleteError;
  }

  const result = spawnSync("npx", ["tsx", "scripts/sync-flashscore.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

main().catch((error) => {
  console.error("ERROR rebuilding Flashscore data", error);
  process.exit(1);
});
