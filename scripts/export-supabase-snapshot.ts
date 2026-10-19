import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readAllRows } from "../lib/readAllRows";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function readTable(table: string, columns: string, order = ["id"]) {
  return readAllRows(async (offset, size) => {
    let query = supabase.from(table).select(columns);
    for (const column of order) query = query.order(column);
    return await query.range(offset, offset + size - 1);
  });
}

async function main() {
  const [competitions, seasons, teams, matches, standingsCache] = await Promise.all([
    readTable("competitions", "id,name,slug,region,country_code,category,group_name,sort_order,is_featured"),
    readTable("seasons", "id,name,competition_id"),
    readTable("teams", "id,name,slug"),
    readTable("matches", "id,season_id,match_date,kickoff_time,status,minute,updated_at,source_url,home_score,away_score,round,venue,home_team_id,away_team_id"),
    readTable("standings_cache", "season_id,team_id,position,played,won,drawn,lost,points_for,points_against,points,source,updated_at", ["season_id", "team_id"]),
  ]);

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
        standings_cache: standingsCache || [],
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Snapshot written: competitions=${competitions?.length ?? 0}, seasons=${seasons?.length ?? 0}, teams=${teams?.length ?? 0}, matches=${matches?.length ?? 0}, standings_cache=${standingsCache?.length ?? 0}`
  );
  console.log(file);
}

main().catch((error) => {
  console.error("ERROR exporting Supabase snapshot", error);
  process.exit(1);
});
