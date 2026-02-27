// scripts/backfillResults.ts
import { createClient } from "@supabase/supabase-js";

type MatchStatus = "NS" | "LIVE" | "FT";

// ---------- CONFIG ----------
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // IMPORTANT: server-side only
const SCRUMBASE_API_KEY = process.env.SCRUMBASE_API_KEY!;

// Si tu API devuelve timezone local, ajustalo. Ideal: guardar kickoff_time en UTC.
const DEFAULT_KICKOFF_TIME = "00:00:00";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SCRUMBASE_API_KEY) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRUMBASE_API_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- HELPERS ----------
function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  match_date: string; // YYYY-MM-DD
  kickoff_time: string | null; // HH:MM:SS
  status: MatchStatus;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue: string | null;
}) {
  // Con el unique index matches_unique_key, esto no duplica.
  const { error } = await supabase.from("matches").upsert(row, {
    onConflict: "season_id,match_date,kickoff_time,home_team_id,away_team_id",
  });

  if (error) throw error;
}

// ---------- SCRUMBASE FETCH (placeholder) ----------
// IMPORTANTE: No puedo garantizar el shape exacto de su JSON sin tu endpoint concreto.
// Ajustá "fetchResultsFromApi" cuando veas la respuesta real.
async function fetchResultsFromApi(params: {
  // ej: seasonExternalId o competitionExternalId
  query: string;
}): Promise<
  Array<{
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM o HH:MM:SS
    home: string;
    away: string;
    hs: number;
    as: number;
    round?: number;
    venue?: string;
  }>
> {
  // Ejemplo genérico:
  // Cambiá la URL al endpoint real que estés usando en Scrumbase.
  const url = `https://api.scrumbase.com/v1/${params.query}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SCRUMBASE_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${res.status}: ${txt}`);
  }

  const json = await res.json();

  // TODO: adaptá esto a la forma real del JSON:
  const items = (json?.data ?? json?.results ?? []) as any[];

  return items.map((x) => ({
    date: String(x.date ?? x.match_date),
    time: String(x.time ?? x.kickoff_time ?? ""),
    home: String(x.home_team?.name ?? x.home ?? ""),
    away: String(x.away_team?.name ?? x.away ?? ""),
    hs: Number(x.home_score ?? x.hs ?? 0),
    as: Number(x.away_score ?? x.as ?? 0),
    round: x.round != null ? Number(x.round) : null,
    venue: x.venue != null ? String(x.venue) : null,
  }));
}

// ---------- MAIN ----------
async function main() {
  // 1) Elegí una season de tu DB
  // Podés filtrar por competition slug si querés.
  const { data: seasons, error: seasonsErr } = await supabase
    .from("seasons")
    .select("id, name, competition_id")
    .order("id", { ascending: false })
    .limit(20);

  if (seasonsErr) throw seasonsErr;

  console.log("Seasons found:", seasons?.map((s) => `${s.id} - ${s.name}`));

  // 👉 Para empezar, agarrá la última season:
  const seasonId = seasons?.[0]?.id;
  if (!seasonId) throw new Error("No seasons in DB");

  // 2) Traé resultados FT desde API
  // 🔥 Acá es donde vos elegís qué endpoint usar. Ejemplos:
  //   query: "competitions/top-14/2026/results"
  //   query: "seasons/123/results"
  const apiQuery = process.env.API_QUERY!;
  if (!apiQuery) throw new Error("Set API_QUERY env var (your API endpoint path)");

  const results = await fetchResultsFromApi({ query: apiQuery });
  console.log("Results fetched:", results.length);

  // 3) Upsert de teams + matches
  for (const r of results) {
    if (!r.date || !r.home || !r.away) continue;

    const kickoff_time =
      r.time && r.time !== "undefined" && r.time !== "null"
        ? (r.time.length === 5 ? `${r.time}:00` : r.time)
        : DEFAULT_KICKOFF_TIME;

    const home = await upsertTeam(r.home, null);
    const away = await upsertTeam(r.away, null);

    await upsertMatch({
      season_id: seasonId,
      match_date: r.date,
      kickoff_time,
      status: "FT",
      home_team_id: home.id,
      away_team_id: away.id,
      home_score: Number.isFinite(r.hs) ? r.hs : null,
      away_score: Number.isFinite(r.as) ? r.as : null,
      round: r.round ?? null,
      venue: r.venue ?? null,
    });
  }

  console.log("✅ Backfill done");
}

main().catch((e) => {
  console.error("❌ Backfill failed:", e);
  process.exit(1);
});