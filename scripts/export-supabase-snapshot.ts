import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const [
    { data: competitions, error: competitionsError },
    { data: seasons, error: seasonsError },
    { data: teams, error: teamsError },
    { data: matches, error: matchesError },
  ] = await Promise.all([
    supabase
      .from("competitions")
      .select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured"),
    supabase.from("seasons").select("id,name,competition_id"),
    supabase.from("teams").select("id,name,slug"),
    supabase
      .from("matches")
      .select(
        "id,season_id,match_date,kickoff_time,status,minute,home_score,away_score,round,venue,home_team_id,away_team_id"
      ),
  ]);

  if (competitionsError) throw competitionsError;
  if (seasonsError) throw seasonsError;
  if (teamsError) throw teamsError;
  if (matchesError) throw matchesError;

  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, "supabase-snapshot.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        competitions: competitions || [],
        seasons: seasons || [],
        teams: teams || [],
        matches: matches || [],
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Snapshot written: competitions=${competitions?.length ?? 0}, seasons=${seasons?.length ?? 0}, teams=${teams?.length ?? 0}, matches=${matches?.length ?? 0}`
  );
  console.log(file);
}

main().catch((error) => {
  console.error("ERROR exporting Supabase snapshot", error);
  process.exit(1);
});
