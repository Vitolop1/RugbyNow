import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackMatchesByDate } from "@/lib/fallbackData";
import { getSnapshotMatchesByDate } from "@/lib/supabaseSnapshot";

type MatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: "NS" | "LIVE" | "FT";
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: number; name: string; slug: string } | null;
  away_team: { id: number; name: string; slug: string } | null;
  season:
    | {
        competition: {
          name: string;
          slug: string;
          region: string | null;
        } | null;
      }
    | null;
};

type RawMatchRow = Omit<MatchRow, "home_team" | "away_team" | "season"> & {
  home_team: MatchRow["home_team"] | MatchRow["home_team"][] | null;
  away_team: MatchRow["away_team"] | MatchRow["away_team"][] | null;
  season:
    | MatchRow["season"]
    | (MatchRow["season"] extends infer T ? T[] : never)
    | null;
};

function unwrapFirst<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeMatchRow(row: RawMatchRow): MatchRow {
  const season = unwrapFirst(row.season);
  const competition = season ? unwrapFirst(season.competition) : null;

  return {
    ...row,
    home_team: unwrapFirst(row.home_team),
    away_team: unwrapFirst(row.away_team),
    season: season ? { competition } : null,
  };
}

function normalizeTeamName(value?: string | null) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    penarol: "penarol rugby",
    "penarol rugby": "penarol rugby",
    cobras: "cobras brasil rugby",
    "cobras brasil rugby": "cobras brasil rugby",
    pampas: "pampas xv",
    "pampas xv": "pampas xv",
    dogos: "dogos xv",
    "dogos xv": "dogos xv",
    yacare: "yacare xv",
    "yacare xv": "yacare xv",
  };

  return aliases[normalized] ?? normalized;
}

function mergeMatches(base: RawMatchRow[], extra: RawMatchRow[]) {
  const byLogicalKey = new Map<string, MatchRow>();

  const keyFor = (row: MatchRow) => {
    const competitionSlug = row.season?.competition?.slug ?? "unknown";
    const home = normalizeTeamName(row.home_team?.name);
    const away = normalizeTeamName(row.away_team?.name);
    return `${row.match_date}|${competitionSlug}|${home}|${away}`;
  };

  for (const rawRow of base) {
    const row = normalizeMatchRow(rawRow);
    byLogicalKey.set(keyFor(row), row);
  }

  for (const rawRow of extra) {
    const row = normalizeMatchRow(rawRow);
    const key = keyFor(row);
    if (!byLogicalKey.has(key)) byLogicalKey.set(key, row);
  }

  return Array.from(byLogicalKey.values()).sort(
    (a, b) =>
      a.match_date.localeCompare(b.match_date) ||
      String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")) ||
      String(a.season?.competition?.name || "").localeCompare(String(b.season?.competition?.name || ""))
  );
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid or missing date" }, { status: 400 });
  }

  try {
    const { data, error } = await serverSupabase
      .from("matches")
      .select(`
        id,
        match_date,
        kickoff_time,
        status,
        minute,
        home_score,
        away_score,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug ),
        season:season_id (
          competition:competition_id ( name, slug, region )
        )
      `)
      .eq("match_date", date)
      .order("kickoff_time", { ascending: true })
      .limit(2000);

    if (error) throw error;

    return NextResponse.json({
      matches: mergeMatches((data || []) as unknown as RawMatchRow[], getFallbackMatchesByDate(date) as unknown as RawMatchRow[]),
      source: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshotMatches = getSnapshotMatchesByDate(date);
    if (snapshotMatches) {
      return NextResponse.json({
        matches: mergeMatches(snapshotMatches as unknown as RawMatchRow[], getFallbackMatchesByDate(date) as unknown as RawMatchRow[]),
        source: "snapshot",
        warning: message,
      });
    }

    return NextResponse.json({
      matches: mergeMatches(getFallbackMatchesByDate(date) as unknown as RawMatchRow[], []),
      source: "fallback",
      warning: message,
    });
  }
}
