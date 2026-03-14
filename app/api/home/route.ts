import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackMatchesByDate } from "@/lib/fallbackData";
import { attachHighlightsToMatches } from "@/lib/matchHighlights";
import { dedupeLogicalMatches } from "@/lib/matchIntegrity";
import { getMatchLocalISODate, isEffectivelyLive } from "@/lib/matchPresentation";
import { getSnapshotMatchesByDate } from "@/lib/supabaseSnapshot";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";

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
  highlight_url?: string | null;
  highlight_title?: string | null;
  highlight_published?: string | null;
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
    capibaras: "capibaras xv",
    "capibaras xv": "capibaras xv",
    "atletico del rosario": "atletico del rosario",
    "atl. del rosario": "atletico del rosario",
    "atletico del rosario ": "atletico del rosario",
    petrarca: "petrarca",
    "petrarca padova": "petrarca",
    lyons: "lyons piacenza",
    "rugby lyons": "lyons piacenza",
    "lyons piacenza": "lyons piacenza",
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

  const qualityFor = (row: MatchRow) => {
    let score = 0;
    if (row.kickoff_time && row.kickoff_time !== "00:00:00" && row.kickoff_time !== "00:00") score += 40;
    if (row.home_score != null && row.away_score != null) score += 20;
    if (row.status === "FT") score += 15;
    else if (row.status === "LIVE") score += 10;
    else if (row.status === "NS") score += 5;
    return score;
  };

  for (const rawRow of base) {
    const row = normalizeMatchRow(rawRow);
    byLogicalKey.set(keyFor(row), row);
  }

  for (const rawRow of extra) {
    const row = normalizeMatchRow(rawRow);
    const key = keyFor(row);
    const current = byLogicalKey.get(key);
    if (!current) {
      byLogicalKey.set(key, row);
      continue;
    }
    if (qualityFor(row) > qualityFor(current)) {
      byLogicalKey.set(key, row);
    }
  }

  return Array.from(byLogicalKey.values()).sort(
    (a, b) =>
      a.match_date.localeCompare(b.match_date) ||
      String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")) ||
      String(a.season?.competition?.name || "").localeCompare(String(b.season?.competition?.name || ""))
  );
}

function parseMatchDateTime(matchDate: string, kickoffTime?: string | null) {
  const normalized = kickoffTime && kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime || "00:00:00";
  const parsed = new Date(`${matchDate}T${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function collapseAdjacentVariants(rows: MatchRow[]) {
  const qualityFor = (row: MatchRow) => {
    let score = 0;
    if (row.kickoff_time && row.kickoff_time !== "00:00:00" && row.kickoff_time !== "00:00") score += 40;
    if (row.home_score != null && row.away_score != null) score += 20;
    if (row.status === "FT") score += 15;
    else if (row.status === "LIVE") score += 10;
    else if (row.status === "NS") score += 5;
    return score;
  };

  const sameLogicalMatch = (left: MatchRow, right: MatchRow) => {
    const leftCompetition = left.season?.competition?.slug ?? "";
    const rightCompetition = right.season?.competition?.slug ?? "";
    if (leftCompetition !== rightCompetition) return false;

    const sameTeams =
      normalizeTeamName(left.home_team?.name) === normalizeTeamName(right.home_team?.name) &&
      normalizeTeamName(left.away_team?.name) === normalizeTeamName(right.away_team?.name);
    if (!sameTeams) return false;

    if (
      left.home_score != null &&
      left.away_score != null &&
      right.home_score != null &&
      right.away_score != null &&
      (left.home_score !== right.home_score || left.away_score !== right.away_score)
    ) {
      return false;
    }

    const leftDate = parseMatchDateTime(left.match_date, left.kickoff_time);
    const rightDate = parseMatchDateTime(right.match_date, right.kickoff_time);
    const placeholder =
      !left.kickoff_time ||
      !right.kickoff_time ||
      left.kickoff_time === "00:00:00" ||
      right.kickoff_time === "00:00:00" ||
      left.kickoff_time === "00:00" ||
      right.kickoff_time === "00:00";

    if (placeholder) {
      const dayDelta = Math.abs(
        (new Date(`${left.match_date}T00:00:00Z`).getTime() - new Date(`${right.match_date}T00:00:00Z`).getTime()) /
          86400000
      );
      return dayDelta <= 1;
    }

    if (!leftDate || !rightDate) return false;
    return Math.abs(leftDate.getTime() - rightDate.getTime()) <= 360 * 60000;
  };

  const selected: MatchRow[] = [];
  for (const row of rows.slice().sort((a, b) => qualityFor(b) - qualityFor(a) || b.id - a.id)) {
    if (selected.some((existing) => sameLogicalMatch(existing, row))) continue;
    selected.push(row);
  }

  return selected.sort(
    (a, b) =>
      (a.status === "LIVE" ? -1 : 0) - (b.status === "LIVE" ? -1 : 0) ||
      a.match_date.localeCompare(b.match_date) ||
      String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")) ||
      String(a.season?.competition?.name || "").localeCompare(String(b.season?.competition?.name || ""))
  );
}

function addDaysISO(iso: string, delta: number) {
  const parsed = new Date(`${iso}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
}

function normalizeMatchesForDate(rows: MatchRow[], selectedDate: string, timeZone: string) {
  const todayInZone = getISODateInTimeZone(new Date(), timeZone);

  const deduped = collapseAdjacentVariants(
    dedupeLogicalMatches(rows, (row) => ({
      id: row.id,
      matchDate: row.match_date,
      kickoffTime: row.kickoff_time,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      homeTeamId: row.home_team?.id ?? null,
      awayTeamId: row.away_team?.id ?? null,
    }))
  );

  return deduped
    .map((row) => {
      const localDate = getMatchLocalISODate(row.match_date, row.kickoff_time, timeZone);
      const effectiveLive = isEffectivelyLive(row.status, row.match_date, row.kickoff_time);

      return {
        ...row,
        match_date: localDate,
        status: row.status === "NS" && effectiveLive ? ("LIVE" as const) : row.status,
      };
    })
    .filter((row) => row.match_date === selectedDate || (selectedDate === todayInZone && row.status === "LIVE"))
    .sort(
      (a, b) =>
        (a.status === "LIVE" ? -1 : 0) - (b.status === "LIVE" ? -1 : 0) ||
        a.match_date.localeCompare(b.match_date) ||
        String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")) ||
        String(a.season?.competition?.name || "").localeCompare(String(b.season?.competition?.name || ""))
    );
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  const timeZone = request.nextUrl.searchParams.get("tz") || "America/New_York";

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid or missing date" }, { status: 400 });
  }

  const candidateDates = [addDaysISO(date, -1), date, addDaysISO(date, 1)];

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
      .in("match_date", candidateDates)
      .order("kickoff_time", { ascending: true })
      .limit(2000);

    if (error) throw error;

    const mergedMatches = mergeMatches(
      (data || []) as unknown as RawMatchRow[],
      candidateDates.flatMap((candidateDate) => getFallbackMatchesByDate(candidateDate)) as unknown as RawMatchRow[]
    );

    return NextResponse.json({
      matches: await attachHighlightsToMatches(normalizeMatchesForDate(mergedMatches, date, timeZone)),
      source: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshotMatches = candidateDates.flatMap((candidateDate) => getSnapshotMatchesByDate(candidateDate) ?? []);
    if (snapshotMatches) {
      const mergedMatches = mergeMatches(
        snapshotMatches as unknown as RawMatchRow[],
        candidateDates.flatMap((candidateDate) => getFallbackMatchesByDate(candidateDate)) as unknown as RawMatchRow[]
      );
      return NextResponse.json({
        matches: await attachHighlightsToMatches(normalizeMatchesForDate(mergedMatches, date, timeZone)),
        source: "snapshot",
        warning: message,
      });
    }

    const fallbackMatches = mergeMatches(
      candidateDates.flatMap((candidateDate) => getFallbackMatchesByDate(candidateDate)) as unknown as RawMatchRow[],
      []
    );
    return NextResponse.json({
      matches: await attachHighlightsToMatches(normalizeMatchesForDate(fallbackMatches, date, timeZone)),
      source: "fallback",
      warning: message,
    });
  }
}
