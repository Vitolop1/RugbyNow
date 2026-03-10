import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

type MatchStatus = "NS" | "LIVE" | "FT";

type ApiResultRow = {
  date: string;
  time?: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  round?: number;
  venue?: string;
};

type ApiResponseItem = {
  date?: string;
  match_date?: string;
  time?: string;
  kickoff_time?: string;
  home_team?: { name?: string | null } | null;
  away_team?: { name?: string | null } | null;
  home?: string;
  away?: string;
  home_score?: number | string;
  away_score?: number | string;
  hs?: number | string;
  as?: number | string;
  round?: number | string | null;
  venue?: string | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCRUMBASE_API_KEY = process.env.SCRUMBASE_API_KEY;
const DEFAULT_KICKOFF_TIME = "00:00:00";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SCRUMBASE_API_KEY) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRUMBASE_API_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function upsertTeam(name: string, countryCode?: string | null) {
  const slug = slugify(name);
  const { data, error } = await supabase
    .from("teams")
    .upsert(
      {
        name,
        slug,
        country_code: countryCode ?? null,
        type: "club",
      },
      { onConflict: "slug" }
    )
    .select("id, name, slug")
    .single();

  if (error) throw error;
  return data as { id: number; name: string; slug: string };
}

async function upsertMatch(row: {
  season_id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue: string | null;
}) {
  const { error } = await supabase.from("matches").upsert(row, {
    onConflict: "season_id,match_date,kickoff_time,home_team_id,away_team_id",
  });

  if (error) throw error;
}

async function fetchResultsFromApi(params: { query: string }): Promise<ApiResultRow[]> {
  const url = `https://api.scrumbase.com/v1/${params.query}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SCRUMBASE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const items = (json?.data ?? json?.results ?? []) as ApiResponseItem[];

  return items.map((item): ApiResultRow => ({
    date: String(item.date ?? item.match_date ?? ""),
    time: item.time == null || item.time === "" ? item.kickoff_time ?? undefined : String(item.time),
    home: String(item.home_team?.name ?? item.home ?? ""),
    away: String(item.away_team?.name ?? item.away ?? ""),
    hs: Number(item.home_score ?? item.hs ?? 0),
    as: Number(item.away_score ?? item.as ?? 0),
    round: item.round == null ? undefined : Number(item.round),
    venue: item.venue == null || item.venue === "" ? undefined : String(item.venue),
  }));
}

async function main() {
  const { data: seasons, error: seasonsErr } = await supabase
    .from("seasons")
    .select("id, name, competition_id")
    .order("id", { ascending: false })
    .limit(20);

  if (seasonsErr) throw seasonsErr;

  console.log("Seasons found:", seasons?.map((season) => `${season.id} - ${season.name}`));

  const seasonId = seasons?.[0]?.id;
  if (!seasonId) throw new Error("No seasons in DB");

  const apiQuery = process.env.API_QUERY;
  if (!apiQuery) throw new Error("Set API_QUERY env var (your API endpoint path)");

  const results = await fetchResultsFromApi({ query: apiQuery });
  console.log("Results fetched:", results.length);

  for (const result of results) {
    if (!result.date || !result.home || !result.away) continue;

    const kickoffTime =
      result.time && result.time !== "undefined" && result.time !== "null"
        ? result.time.length === 5
          ? `${result.time}:00`
          : result.time
        : DEFAULT_KICKOFF_TIME;

    const home = await upsertTeam(result.home, null);
    const away = await upsertTeam(result.away, null);

    await upsertMatch({
      season_id: seasonId,
      match_date: result.date,
      kickoff_time: kickoffTime,
      status: "FT",
      home_team_id: home.id,
      away_team_id: away.id,
      home_score: Number.isFinite(result.hs) ? result.hs : null,
      away_score: Number.isFinite(result.as) ? result.as : null,
      round: result.round ?? null,
      venue: result.venue ?? null,
    });
  }

  console.log("Backfill done");
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
