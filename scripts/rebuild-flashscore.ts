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

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === "object") {
    return { ...(error as Record<string, unknown>) };
  }

  return { message: String(error) };
}

async function main() {
  if (DRY_RUN) {
    console.log("DRY_RUN=1 -> skip DB reset, running sync-flashscore only.");
  } else {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    console.log("Checking existing Flashscore rows...");

    const standingsCountResult = await supabase
      .from("standings_cache")
      .select("*", { count: "exact", head: true })
      .eq("source", "flashscore");
    if (standingsCountResult.error) {
      throw {
        step: "count standings_cache",
        ...describeError(standingsCountResult.error),
      };
    }

    const matchesCountResult = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("source", "flashscore");
    if (matchesCountResult.error) {
      throw {
        step: "count matches",
        ...describeError(matchesCountResult.error),
      };
    }

    console.log(
      `Resetting Flashscore data -> standings_cache=${standingsCountResult.count ?? 0}, matches=${matchesCountResult.count ?? 0}`
    );

    const standingsDeleteResult = await supabase.from("standings_cache").delete().eq("source", "flashscore");
    if (standingsDeleteResult.error) {
      throw {
        step: "delete standings_cache",
        ...describeError(standingsDeleteResult.error),
      };
    }

    const matchesDeleteResult = await supabase.from("matches").delete().eq("source", "flashscore");
    if (matchesDeleteResult.error) {
      throw {
        step: "delete matches",
        ...describeError(matchesDeleteResult.error),
      };
    }
  }

  console.log("Starting sync-flashscore...");

  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

  const result = spawnSync(npxBin, ["tsx", "scripts/sync-flashscore.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw {
      step: "spawn sync-flashscore",
      ...describeError(result.error),
      status: result.status,
      signal: result.signal,
    };
  }

  if (result.signal) {
    throw {
      step: "sync-flashscore terminated by signal",
      status: result.status,
      signal: result.signal,
    };
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw {
      step: "sync-flashscore exited non-zero",
      status: result.status,
      signal: result.signal,
    };
  }
}

main().catch((error) => {
  console.error("ERROR rebuilding Flashscore data", describeError(error));
  process.exit(1);
});
