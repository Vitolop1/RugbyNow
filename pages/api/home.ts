import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSupabase } from "@/lib/serverSupabase";
import { getFallbackMatchesByDate } from "@/lib/fallbackData";
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
};

type RawMatchRow = Omit<MatchRow, "home_team" | "away_team" | "season"> & {
  home_team: MatchRow["home_team"] | MatchRow["home_team"][] | null;
  away_team: MatchRow["away_team"] | MatchRow["away_team"][] | null;
  season:
    | MatchRow["season"]
    | (MatchRow["season"] extends infer T ? T[] : never)
    | null;
};

function firstString(value: string | string[] | undefined, fallback?: string) {
  if (Array.isArray(value)) return value[0] ?? fallback ?? "";
  return value ?? fallback ?? "";
}

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

function addDaysISO(iso: string, delta: number) {
  const parsed = new Date(`${iso}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
}

function parseKickoffDateTime(matchDate: string, kickoffTime?: string | null) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  if (!normalized) return null;
  const parsed = new Date(`${matchDate}T${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLocalMatchDate(matchDate: string, kickoffTime: string | null | undefined, timeZone: string) {
  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return matchDate;
  return getISODateInTimeZone(kickoff, timeZone);
}

function isEffectivelyLive(status: MatchRow["status"], matchDate: string, kickoffTime: string | null | undefined, now = new Date()) {
  if (status === "LIVE") return true;
  if (status === "FT") return false;
  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return false;
  const diffMinutes = Math.floor((now.getTime() - kickoff.getTime()) / 60000);
  return diffMinutes >= 0 && diffMinutes <= 130;
}

function normalizeMatchesForDate(rows: MatchRow[], selectedDate: string, timeZone: string) {
  const todayInZone = getISODateInTimeZone(new Date(), timeZone);
  const byLogicalKey = new Map<string, MatchRow>();

  const qualityFor = (row: MatchRow) => {
    let score = 0;
    if (row.kickoff_time && row.kickoff_time !== "00:00:00" && row.kickoff_time !== "00:00") score += 40;
    if (row.home_score != null && row.away_score != null) score += 20;
    if (row.status === "FT") score += 15;
    else if (row.status === "LIVE") score += 10;
    else if (row.status === "NS") score += 5;
    return score;
  };

  for (const row of rows) {
    const localDate = getLocalMatchDate(row.match_date, row.kickoff_time, timeZone);
    const effectiveLive = isEffectivelyLive(row.status, row.match_date, row.kickoff_time);
    const normalizedRow: MatchRow = {
      ...row,
      match_date: localDate,
      status: row.status === "NS" && effectiveLive ? ("LIVE" as const) : row.status,
    };

    if (!(normalizedRow.match_date === selectedDate || (selectedDate === todayInZone && normalizedRow.status === "LIVE"))) {
      continue;
    }

    const competitionSlug = normalizedRow.season?.competition?.slug ?? "unknown";
    const home = normalizeTeamName(normalizedRow.home_team?.name);
    const away = normalizeTeamName(normalizedRow.away_team?.name);
    const key = `${normalizedRow.match_date}|${competitionSlug}|${home}|${away}`;
    const current = byLogicalKey.get(key);
    if (!current || qualityFor(normalizedRow) > qualityFor(current)) {
      byLogicalKey.set(key, normalizedRow);
    }
  }

  return Array.from(byLogicalKey.values()).sort(
    (a, b) =>
      (a.status === "LIVE" ? -1 : 0) - (b.status === "LIVE" ? -1 : 0) ||
      a.match_date.localeCompare(b.match_date) ||
      String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")) ||
      String(a.season?.competition?.name || "").localeCompare(String(b.season?.competition?.name || ""))
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const date = firstString(req.query.date);
  const timeZone = firstString(req.query.tz, "America/New_York");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid or missing date" });
  }

  const candidateDates = [addDaysISO(date, -1), date, addDaysISO(date, 1)];
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");

  try {
    const serverSupabase = getServerSupabase();
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

    return res.status(200).json({
      matches: normalizeMatchesForDate(
        mergeMatches(
          (data || []) as unknown as RawMatchRow[],
          candidateDates.flatMap((candidateDate) => getFallbackMatchesByDate(candidateDate)) as unknown as RawMatchRow[]
        ),
        date,
        timeZone
      ),
      source: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshotMatches = candidateDates.flatMap((candidateDate) => getSnapshotMatchesByDate(candidateDate) ?? []);
    if (snapshotMatches) {
      return res.status(200).json({
        matches: normalizeMatchesForDate(
          mergeMatches(
            snapshotMatches as unknown as RawMatchRow[],
            candidateDates.flatMap((candidateDate) => getFallbackMatchesByDate(candidateDate)) as unknown as RawMatchRow[]
          ),
          date,
          timeZone
        ),
        source: "snapshot",
        warning: message,
      });
    }

    return res.status(200).json({
      matches: normalizeMatchesForDate(
        mergeMatches(candidateDates.flatMap((candidateDate) => getFallbackMatchesByDate(candidateDate)) as unknown as RawMatchRow[], []),
        date,
        timeZone
      ),
      source: "fallback",
      warning: message,
    });
  }
}
