import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSupabase } from "@/lib/serverSupabase";
import { getFallbackMatchesByDate } from "@/lib/fallbackData";
import { getManualStatusOverride } from "@/lib/competitionMessaging";
import {
  getEffectiveMatchState,
  isActiveMatchStatus,
  parseKickoffDateTime,
  shouldAutoFinalizeMatch,
  type MatchStatus,
} from "@/lib/matchStatus";
import { getSnapshotMatchesByDate } from "@/lib/supabaseSnapshot";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";

type MatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
  minute: number | null;
  updated_at?: string | null;
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

function isPlaceholderKickoffTime(kickoffTime?: string | null) {
  return !kickoffTime || kickoffTime === "00:00:00" || kickoffTime === "00:00";
}

function parseMatchDateTime(matchDate: string, kickoffTime?: string | null) {
  const normalizedTime = kickoffTime && kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime || "00:00:00";
  const parsed = new Date(`${matchDate}T${normalizedTime}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetweenMatchDates(leftDate: string, rightDate: string) {
  const left = new Date(`${leftDate}T00:00:00Z`);
  const right = new Date(`${rightDate}T00:00:00Z`);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(left.getTime() - right.getTime()) / 86400000;
}

function sameKnownScore(left: MatchRow, right: MatchRow) {
  return (
    left.home_score != null &&
    left.away_score != null &&
    right.home_score != null &&
    right.away_score != null &&
    left.home_score === right.home_score &&
    left.away_score === right.away_score
  );
}

function areMatchDuplicates(left: MatchRow, right: MatchRow) {
  const leftCompetitionSlug = left.season?.competition?.slug ?? "unknown";
  const rightCompetitionSlug = right.season?.competition?.slug ?? "unknown";
  if (leftCompetitionSlug !== rightCompetitionSlug) return false;

  const leftHome = normalizeTeamName(left.home_team?.name);
  const leftAway = normalizeTeamName(left.away_team?.name);
  const rightHome = normalizeTeamName(right.home_team?.name);
  const rightAway = normalizeTeamName(right.away_team?.name);
  if (leftHome !== rightHome || leftAway !== rightAway) return false;

  const dateGapDays = daysBetweenMatchDates(left.match_date, right.match_date);
  if (dateGapDays > 2) return false;

  if (
    left.home_score != null &&
    left.away_score != null &&
    right.home_score != null &&
    right.away_score != null &&
    !sameKnownScore(left, right)
  ) {
    return false;
  }

  if (left.status === "FT" && right.status === "FT") {
    return sameKnownScore(left, right);
  }

  const leftDateTime = parseMatchDateTime(left.match_date, left.kickoff_time);
  const rightDateTime = parseMatchDateTime(right.match_date, right.kickoff_time);
  const minutesApart =
    !leftDateTime || !rightDateTime ? Number.POSITIVE_INFINITY : Math.abs(leftDateTime.getTime() - rightDateTime.getTime()) / 60000;

  return (
    minutesApart <= 360 ||
    isPlaceholderKickoffTime(left.kickoff_time) ||
    isPlaceholderKickoffTime(right.kickoff_time)
  );
}

function mergeMatches(base: RawMatchRow[], extra: RawMatchRow[]) {
  const byBucket = new Map<string, Array<{ row: MatchRow; isPrimary: boolean }>>();

  const bucketKeyFor = (row: MatchRow) => {
    const competitionSlug = row.season?.competition?.slug ?? "unknown";
    const home = normalizeTeamName(row.home_team?.name);
    const away = normalizeTeamName(row.away_team?.name);
    return `${competitionSlug}|${home}|${away}`;
  };

  const qualityFor = (row: MatchRow) => {
    let score = 0;
    if (row.kickoff_time && row.kickoff_time !== "00:00:00" && row.kickoff_time !== "00:00") score += 40;
    if (row.home_score != null && row.away_score != null) score += 20;
    if (row.status === "FT") score += 15;
    else if (isActiveMatchStatus(row.status)) score += 10;
    else if (row.status === "CANC") score += 6;
    else if (row.status === "NS") score += 5;
    return score;
  };

  const insertRow = (rawRow: RawMatchRow, isPrimary: boolean) => {
    const row = normalizeMatchRow(rawRow);
    const key = bucketKeyFor(row);
    const bucket = byBucket.get(key) ?? [];
    const currentIndex = bucket.findIndex((entry) => areMatchDuplicates(entry.row, row));

    if (currentIndex === -1) {
      bucket.push({ row, isPrimary });
      byBucket.set(key, bucket);
      return;
    }

    const current = bucket[currentIndex];

    if (current.isPrimary && !isPrimary) {
      return;
    }

    if (isPrimary && !current.isPrimary) {
      bucket[currentIndex] = { row, isPrimary };
      byBucket.set(key, bucket);
      return;
    }

    if (qualityFor(row) > qualityFor(current.row)) {
      bucket[currentIndex] = { row, isPrimary };
      byBucket.set(key, bucket);
    }
  };

  for (const rawRow of base) insertRow(rawRow, true);
  for (const rawRow of extra) insertRow(rawRow, false);

  return Array.from(byBucket.values())
    .flatMap((bucket) => bucket.map((entry) => entry.row))
    .sort(
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

function getLocalMatchDate(matchDate: string, kickoffTime: string | null | undefined, timeZone: string) {
  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return matchDate;
  return getISODateInTimeZone(kickoff, timeZone);
}

function normalizeMatchesForDate(rows: MatchRow[], selectedDate: string, timeZone: string) {
  const todayInZone = getISODateInTimeZone(new Date(), timeZone);
  const byLogicalKey = new Map<string, MatchRow>();

  const qualityFor = (row: MatchRow) => {
    let score = 0;
    if (row.kickoff_time && row.kickoff_time !== "00:00:00" && row.kickoff_time !== "00:00") score += 40;
    if (row.home_score != null && row.away_score != null) score += 20;
    if (row.status === "FT") score += 15;
    else if (isActiveMatchStatus(row.status)) score += 10;
    else if (row.status === "CANC") score += 6;
    else if (row.status === "NS") score += 5;
    return score;
  };

  for (const row of rows) {
    const localDate = getLocalMatchDate(row.match_date, row.kickoff_time, timeZone);
    const effective = getEffectiveMatchState(
      row.status,
      row.match_date,
      row.kickoff_time,
      row.minute,
      row.season?.competition?.slug,
      row.updated_at
    );
    const autoFinalized = shouldAutoFinalizeMatch(
      row.status,
      row.match_date,
      row.kickoff_time,
      row.home_score,
      row.away_score,
      row.season?.competition?.slug
    );
    const normalizedRow: MatchRow = {
      ...row,
      match_date: localDate,
      status: autoFinalized ? "FT" : effective.status,
      minute: autoFinalized ? null : effective.minute,
    };
    const manualOverride = getManualStatusOverride({
      competitionSlug: row.season?.competition?.slug,
      matchDate: row.match_date,
      status: normalizedRow.status,
      homeTeamSlug: row.home_team?.slug,
      awayTeamSlug: row.away_team?.slug,
      homeScore: row.home_score,
      awayScore: row.away_score,
    });
    if (manualOverride) {
      normalizedRow.status = manualOverride.status;
      normalizedRow.minute = manualOverride.minute;
    }

    if (!(normalizedRow.match_date === selectedDate || (selectedDate === todayInZone && isActiveMatchStatus(normalizedRow.status)))) {
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
      (isActiveMatchStatus(a.status) ? -1 : 0) - (isActiveMatchStatus(b.status) ? -1 : 0) ||
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
    const snapshotMatches = candidateDates.flatMap((candidateDate) => getSnapshotMatchesByDate(candidateDate) ?? []);
    const { data, error } = await serverSupabase
      .from("matches")
      .select(`
        id,
        match_date,
        kickoff_time,
        status,
        minute,
        updated_at,
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
          mergeMatches(
            (data || []) as unknown as RawMatchRow[],
            snapshotMatches as unknown as RawMatchRow[]
          ) as unknown as RawMatchRow[],
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
    if (snapshotMatches.length > 0) {
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
