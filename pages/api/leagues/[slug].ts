import type { NextApiRequest, NextApiResponse } from "next";
import { mergeCompetitionCatalog } from "@/lib/competitionPrefs";
import { getCompetitionProfile } from "@/lib/competitionProfiles";
import { getCompetitionNoticeKey, getManualStatusOverride } from "@/lib/competitionMessaging";
import { getCountryProfile } from "@/lib/countryProfiles";
import { attachKnockoutPhaseMeta, deriveLeagueRoundData, parseKnockoutMetaFromSourceUrl, phaseSortOrder, pickAutoRound, stageSortOrder } from "@/lib/leagueRounds";
import { getEffectiveMatchState, isActiveMatchStatus, type MatchStatus } from "@/lib/matchStatus";
import { dedupeLogicalMatches } from "@/lib/matchIntegrity";
import { getServerSupabase } from "@/lib/serverSupabase";
import { getFallbackLeagueData, isCuratedOnlyCompetition } from "@/lib/fallbackData";
import { getSnapshotLeagueData } from "@/lib/supabaseSnapshot";

type StandingsAccumulator = {
  teamId: number;
  team: string;
  teamSlug: string | null;
  pj: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pts: number;
  form?: Array<"W" | "D" | "L">;
};

type StandingCacheRow = {
  team_id: number | null;
  position: number | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points: number | null;
};

type SeasonRow = {
  id: number;
  name: string;
  competition_id: number;
};

type MatchMetaRow = {
  id: number;
  season_id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
};

type MatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
  minute: number | null;
  updated_at?: string | null;
  source_url?: string | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue?: string | null;
  home_team: { id: number; name: string; slug: string | null } | { id: number; name: string; slug: string | null }[] | null;
  away_team: { id: number; name: string; slug: string | null } | { id: number; name: string; slug: string | null }[] | null;
};

type CompetitionRow = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  country_code?: string | null;
  category?: string | null;
  group_name?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
};

function firstString(value: string | string[] | undefined, fallback?: string) {
  if (Array.isArray(value)) return value[0] ?? fallback ?? "";
  return value ?? fallback ?? "";
}

function unwrapTeam(
  value:
    | { id: number; name: string; slug: string | null }
    | { id: number; name: string; slug: string | null }[]
    | null
    | undefined
) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function mergeLeagueMatches(primary: MatchRow[], secondary: MatchRow[]) {
  const byBucket = new Map<string, Array<{ row: MatchRow; isPrimary: boolean }>>();

  const bucketKeyFor = (row: MatchRow) => {
    const home = unwrapTeam(row.home_team);
    const away = unwrapTeam(row.away_team);
    return `${home?.id ?? "x"}|${away?.id ?? "x"}`;
  };

  const isPlaceholderKickoffTime = (kickoffTime?: string | null) =>
    !kickoffTime || kickoffTime === "00:00:00" || kickoffTime === "00:00";

  const parseMatchDateTime = (matchDate: string, kickoffTime?: string | null) => {
    const normalizedTime = kickoffTime && kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime || "00:00:00";
    const parsed = new Date(`${matchDate}T${normalizedTime}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const daysBetweenMatchDates = (leftDate: string, rightDate: string) => {
    const left = new Date(`${leftDate}T00:00:00Z`);
    const right = new Date(`${rightDate}T00:00:00Z`);
    if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return Number.POSITIVE_INFINITY;
    return Math.abs(left.getTime() - right.getTime()) / 86400000;
  };

  const sameKnownScore = (left: MatchRow, right: MatchRow) =>
    left.home_score != null &&
    left.away_score != null &&
    right.home_score != null &&
    right.away_score != null &&
    left.home_score === right.home_score &&
    left.away_score === right.away_score;

  const areLeagueMatchDuplicates = (left: MatchRow, right: MatchRow) => {
    const leftHome = unwrapTeam(left.home_team);
    const leftAway = unwrapTeam(left.away_team);
    const rightHome = unwrapTeam(right.home_team);
    const rightAway = unwrapTeam(right.away_team);

    if (!leftHome?.id || !leftAway?.id || !rightHome?.id || !rightAway?.id) return false;
    if (leftHome.id !== rightHome.id || leftAway.id !== rightAway.id) return false;

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

  const insertRow = (row: MatchRow, isPrimary: boolean) => {
    const key = bucketKeyFor(row);
    const bucket = byBucket.get(key) ?? [];
    const currentIndex = bucket.findIndex((entry) => areLeagueMatchDuplicates(entry.row, row));

    if (currentIndex === -1) {
      bucket.push({ row, isPrimary });
      byBucket.set(key, bucket);
      return;
    }

    const current = bucket[currentIndex];
    if (current.isPrimary && !isPrimary) return;

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

  for (const row of primary) insertRow(row, true);
  for (const row of secondary) insertRow(row, false);

  return Array.from(byBucket.values())
    .flatMap((bucket) => bucket.map((entry) => entry.row))
    .sort(
    (a, b) => a.match_date.localeCompare(b.match_date) || String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || ""))
  );
}

function collapseLeagueMatches(rows: MatchRow[]) {
  const bestByLogicalKey = new Map<string, MatchRow>();

  const qualityFor = (row: MatchRow) => {
    let score = 0;
    if (row.kickoff_time && row.kickoff_time !== "00:00:00" && row.kickoff_time !== "00:00") score += 40;
    if (row.home_score != null && row.away_score != null) score += 20;
    if (row.status === "FT") score += 15;
    else if (isActiveMatchStatus(row.status)) score += 10;
    else if (row.status === "CANC") score += 6;
    else if (row.status === "NS") score += 5;
    if (row.updated_at) score += 3;
    if (row.id >= 1000) score += 2;
    return score;
  };

  const updatedAtValue = (row: MatchRow) => {
    if (!row.updated_at) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(row.updated_at);
    return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
  };

  for (const row of rows) {
    const home = unwrapTeam(row.home_team);
    const away = unwrapTeam(row.away_team);
    const homeKey = home?.slug?.trim().toLowerCase() || String(home?.id ?? "x");
    const awayKey = away?.slug?.trim().toLowerCase() || String(away?.id ?? "x");
    const logicalKey = `${row.match_date}|${homeKey}|${awayKey}`;
    const current = bestByLogicalKey.get(logicalKey);

    if (!current) {
      bestByLogicalKey.set(logicalKey, row);
      continue;
    }

    const qualityDelta = qualityFor(row) - qualityFor(current);
    if (qualityDelta > 0) {
      bestByLogicalKey.set(logicalKey, row);
      continue;
    }

    if (qualityDelta === 0 && updatedAtValue(row) > updatedAtValue(current)) {
      bestByLogicalKey.set(logicalKey, row);
      continue;
    }

    if (qualityDelta === 0 && updatedAtValue(row) === updatedAtValue(current) && row.id > current.id) {
      bestByLogicalKey.set(logicalKey, row);
    }
  }

  return Array.from(bestByLogicalKey.values()).sort(
    (a, b) =>
      a.match_date.localeCompare(b.match_date) ||
      String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")) ||
      (unwrapTeam(a.home_team)?.name || "").localeCompare(unwrapTeam(b.home_team)?.name || "")
  );
}

function finalizeLeagueMatches(rows: MatchRow[]) {
  const deduped = new Map<string, MatchRow>();

  const updatedAtValue = (row: MatchRow) => {
    if (!row.updated_at) return Number.NEGATIVE_INFINITY;
    const parsed = new Date(row.updated_at);
    return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime();
  };

  const qualityFor = (row: MatchRow) => {
    let score = 0;
    if (row.home_score != null && row.away_score != null) score += 20;
    if (row.status === "FT") score += 15;
    else if (isActiveMatchStatus(row.status)) score += 10;
    else if (row.status === "CANC") score += 6;
    else if (row.status === "NS") score += 5;
    if (row.updated_at) score += 3;
    if (row.id >= 1000) score += 2;
    return score;
  };

  for (const row of rows) {
    const home = unwrapTeam(row.home_team);
    const away = unwrapTeam(row.away_team);
    const key = `${row.match_date}|${home?.slug ?? home?.name ?? "x"}|${away?.slug ?? away?.name ?? "x"}`;
    const current = deduped.get(key);

    if (!current) {
      deduped.set(key, row);
      continue;
    }

    const qualityDelta = qualityFor(row) - qualityFor(current);
    if (qualityDelta > 0) {
      deduped.set(key, row);
      continue;
    }

    if (qualityDelta === 0 && updatedAtValue(row) > updatedAtValue(current)) {
      deduped.set(key, row);
      continue;
    }

    if (qualityDelta === 0 && updatedAtValue(row) === updatedAtValue(current) && row.id > current.id) {
      deduped.set(key, row);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) =>
      a.match_date.localeCompare(b.match_date) ||
      String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")) ||
      (unwrapTeam(a.home_team)?.name || "").localeCompare(unwrapTeam(b.home_team)?.name || "")
  );
}

function dedupeMatches(rows: MatchRow[]) {
  return dedupeLogicalMatches(rows, (row) => {
    const home = Array.isArray(row.home_team) ? row.home_team[0] : row.home_team;
    const away = Array.isArray(row.away_team) ? row.away_team[0] : row.away_team;
    return {
      id: row.id,
      matchDate: row.match_date,
      kickoffTime: row.kickoff_time,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      homeTeamId: home?.id ?? null,
      awayTeamId: away?.id ?? null,
    };
  });
}

function shouldPreferMoreCompleteRound(primaryMatches: MatchRow[], fallbackMatches: MatchRow[]) {
  if (!fallbackMatches.length) return false;
  if (!primaryMatches.length) return true;
  const primaryFt = primaryMatches.filter((item) => item.status === "FT").length;
  const fallbackFt = fallbackMatches.filter((item) => item.status === "FT").length;
  if (fallbackMatches.length > primaryMatches.length) return true;
  if (fallbackFt > primaryFt) return true;
  const primaryHasScores = primaryMatches.some((item) => item.home_score != null && item.away_score != null);
  const fallbackHasScores = fallbackMatches.some((item) => item.home_score != null && item.away_score != null);
  return fallbackHasScores && !primaryHasScores;
}

function normalizeRuntimeMatchStatus(row: MatchRow, competitionSlug?: string | null): MatchRow {
  const effective = getEffectiveMatchState(
    row.status,
    row.match_date,
    row.kickoff_time,
    row.minute,
    competitionSlug,
    row.updated_at
  );
  const normalized = {
    ...row,
    status: effective.status,
    minute: effective.minute,
  };
  const home = Array.isArray(row.home_team) ? row.home_team[0] : row.home_team;
  const away = Array.isArray(row.away_team) ? row.away_team[0] : row.away_team;
  const manualOverride = getManualStatusOverride({
    competitionSlug,
    matchDate: row.match_date,
    status: normalized.status,
    homeTeamSlug: home?.slug,
    awayTeamSlug: away?.slug,
    homeScore: row.home_score,
    awayScore: row.away_score,
  });
  if (manualOverride) {
    normalized.status = manualOverride.status;
    normalized.minute = manualOverride.minute;
  }
  return normalized;
}

type PhaseKey = "round32" | "round16" | "quarterfinal" | "semifinal" | "final";

function nextKnockoutPhase(phaseKey: PhaseKey): PhaseKey | null {
  if (phaseKey === "round32") return "round16";
  if (phaseKey === "round16") return "quarterfinal";
  if (phaseKey === "quarterfinal") return "semifinal";
  if (phaseKey === "semifinal") return "final";
  return null;
}

function syntheticKnockoutSeedLabel(phaseKey: PhaseKey, seed: number) {
  const short =
    phaseKey === "round32" ? "R32" : phaseKey === "round16" ? "R16" : phaseKey === "quarterfinal" ? "QF" : phaseKey === "semifinal" ? "SF" : "F";
  return `Winner ${short}${seed}`;
}

function appendSyntheticKnockoutRounds(
  roundMeta: Array<{ round: number; first_date: string; last_date: string; matches: number; ft: number; phaseKey?: string | null; stageLabel?: string | null }>,
  matches: MatchRow[]
) {
  return {
    roundMeta: roundMeta.slice().sort((a, b) => a.first_date.localeCompare(b.first_date) || a.round - b.round),
    matches,
  };
}

function resolveLeagueDisplayRound(row: Pick<MatchRow, "round" | "source_url">) {
  const knockoutMeta = parseKnockoutMetaFromSourceUrl(row.source_url);
  if (knockoutMeta.phaseKey) {
    return 1000 + stageSortOrder(knockoutMeta.stageLabel) + phaseSortOrder(knockoutMeta.phaseKey);
  }
  return row.round ?? null;
}

function filterVisibleLeagueMatches(
  matches: MatchRow[],
  roundMeta: Array<{ round: number; phaseKey?: string | null; stageLabel?: string | null }>,
  selectedRound: number | null
) {
  if (selectedRound == null) return matches;

  const selectedMeta = roundMeta.find((item) => item.round === selectedRound);
  if (!selectedMeta?.phaseKey) {
    return matches;
  }

  const nextPhase = nextKnockoutPhase(selectedMeta.phaseKey as PhaseKey);
  const selectedStage = selectedMeta.stageLabel || "__main__";

  return matches.filter((row) => {
    const rowRound = resolveLeagueDisplayRound(row);
    if (rowRound === selectedRound) return true;

    if (!nextPhase) return false;
    const rowMeta = parseKnockoutMetaFromSourceUrl(row.source_url);
    return rowMeta.phaseKey === nextPhase && (rowMeta.stageLabel || "__main__") === selectedStage;
  });
}

function hasUsableStandingCache(rows: StandingCacheRow[]) {
  return rows.some((row) => row.played != null || row.won != null || row.drawn != null || row.lost != null || row.points_for != null || row.points_against != null || row.points != null);
}

function seasonSortKey(name: string) {
  const s = (name || "").trim();
  const mRange = s.match(/\b(\d{4})\s*\/\s*(\d{2,4})\b/);
  if (mRange) {
    const a = Number.parseInt(mRange[1], 10);
    const bRaw = mRange[2];
    const b = bRaw.length === 2 ? Number.parseInt(`${mRange[1].slice(0, 2)}${bRaw}`, 10) : Number.parseInt(bRaw, 10);
    return Math.max(a, b);
  }
  const mYear = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (mYear) return Number.parseInt(mYear[1], 10);
  return 0;
}

function rangeDistanceDays(refISO: string, firstISO: string, lastISO: string) {
  const ref = new Date(`${refISO}T00:00:00Z`).getTime();
  const first = new Date(`${firstISO}T00:00:00Z`).getTime();
  const last = new Date(`${lastISO}T00:00:00Z`).getTime();
  if (ref < first) return (first - ref) / 86400000;
  if (ref > last) return (ref - last) / 86400000;
  return 0;
}

function pickSeasonForReference(seasons: SeasonRow[], matches: MatchMetaRow[], refISO: string) {
  const summaries = seasons.map((season) => {
    const seasonMatches = matches.filter((row) => row.season_id === season.id);
    if (!seasonMatches.length) return { season, count: 0, distance: Number.POSITIVE_INFINITY, first: "", last: "" };
    const dates = seasonMatches.map((row) => row.match_date).sort();
    return { season, count: seasonMatches.length, distance: rangeDistanceDays(refISO, dates[0], dates[dates.length - 1]), first: dates[0], last: dates[dates.length - 1] };
  }).sort((a, b) => {
    if (!!a.count !== !!b.count) return a.count ? -1 : 1;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.last !== b.last) return b.last.localeCompare(a.last);
    return seasonSortKey(b.season.name) - seasonSortKey(a.season.name);
  });
  return summaries[0]?.season ?? seasons.slice().sort((a, b) => seasonSortKey(b.name) - seasonSortKey(a.name))[0] ?? null;
}

function buildRecentForm(rows: MatchRow[]) {
  const formMap = new Map<number, Array<"W" | "D" | "L">>();
  const sorted = rows.filter((item) => item.status === "FT" && item.home_score != null && item.away_score != null).slice().sort(
    (a, b) => b.match_date.localeCompare(a.match_date) || String(b.kickoff_time || "").localeCompare(String(a.kickoff_time || ""))
  );
  for (const row of sorted) {
    const home = Array.isArray(row.home_team) ? row.home_team[0] : row.home_team;
    const away = Array.isArray(row.away_team) ? row.away_team[0] : row.away_team;
    if (!home?.id || !away?.id || row.home_score == null || row.away_score == null) continue;
    const homeForm = formMap.get(home.id) || [];
    const awayForm = formMap.get(away.id) || [];
    if (homeForm.length < 5) {
      homeForm.push(row.home_score > row.away_score ? "W" : row.home_score < row.away_score ? "L" : "D");
      formMap.set(home.id, homeForm);
    }
    if (awayForm.length < 5) {
      awayForm.push(row.away_score > row.home_score ? "W" : row.away_score < row.home_score ? "L" : "D");
      formMap.set(away.id, awayForm);
    }
  }
  return formMap;
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; code?: unknown };
    const parts = [candidate.message, candidate.details, candidate.code]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map((value) => String(value).trim());
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const slug = firstString(req.query.slug);
  const refISO = firstString(req.query.date) && /^\d{4}-\d{2}-\d{2}$/.test(firstString(req.query.date)) ? firstString(req.query.date) : new Date().toISOString().slice(0, 10);
  const roundOverrideRaw = firstString(req.query.round);
  const roundOverride = roundOverrideRaw && /^\d+$/.test(roundOverrideRaw) ? Number.parseInt(roundOverrideRaw, 10) : null;

  try {
    const serverSupabase = getServerSupabase();
    const snapshot = getSnapshotLeagueData(slug, refISO, roundOverride);
    const { data: competition, error: competitionError } = await serverSupabase.from("competitions").select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured").eq("slug", slug).maybeSingle();
    if (competitionError || !competition) throw new Error(`No competition found for slug: ${slug}`);
    const fallback = getFallbackLeagueData(slug, refISO, roundOverride);
    const mergedCompetition = mergeCompetitionCatalog<CompetitionRow>([competition as CompetitionRow], fallback ? [fallback.competition as CompetitionRow] : [])[0] ?? (competition as CompetitionRow);
    const competitionProfile = getCompetitionProfile(mergedCompetition.slug, {
      name: mergedCompetition.name,
      country: mergedCompetition.country_code ?? undefined,
      region: mergedCompetition.region ?? undefined,
    });
    const regionProfile = getCountryProfile(competitionProfile.country ?? mergedCompetition.region);
    if (isCuratedOnlyCompetition(slug) && fallback) {
      return res.status(200).json({
        ...fallback,
        competition: mergedCompetition,
        noticeKey: getCompetitionNoticeKey(mergedCompetition.slug),
        profile: competitionProfile,
        regionProfile,
        knockoutRoundMeta: [],
        knockoutMatches: [],
        standingsSource: slug === "ar-liga-norte-grande" ? "curated" : "computed",
        source: "fallback-curated",
      });
    }
    const { data: seasons, error: seasonsError } = await serverSupabase.from("seasons").select("id,name,competition_id").eq("competition_id", competition.id).order("name", { ascending: false });
    if (seasonsError || !seasons?.length) throw new Error(`No season found for: ${slug}`);
    const { data: seasonMatchMeta, error: seasonMetaError } = await serverSupabase.from("matches").select("id,season_id,match_date,kickoff_time,status").in("season_id", seasons.map((row) => row.id)).order("match_date", { ascending: true }).order("kickoff_time", { ascending: true });
    if (seasonMetaError) throw seasonMetaError;
    const season = pickSeasonForReference((seasons || []) as SeasonRow[], (seasonMatchMeta || []) as MatchMetaRow[], refISO);
    if (!season) throw new Error(`No season found for: ${slug}`);
    const { data: competitions, error: competitionsError } = await serverSupabase.from("competitions").select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured").order("is_featured", { ascending: false }).order("group_name", { ascending: true }).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (competitionsError) throw competitionsError;
    const mergedCompetitions = mergeCompetitionCatalog<CompetitionRow>((competitions || []) as CompetitionRow[], fallback ? (fallback.competitions as CompetitionRow[]) : []);
    const { data: seasonMatches, error: seasonMatchesError } = await serverSupabase.from("matches").select(`
        id, match_date, kickoff_time, status, minute, updated_at, source_url, home_score, away_score, round, venue,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug )
      `).eq("season_id", season.id).order("match_date", { ascending: true });
    if (seasonMatchesError) throw seasonMatchesError;
    const detailedMatches = dedupeLogicalMatches((seasonMatches || []) as MatchRow[], (row) => ({
      id: row.id,
      matchDate: row.match_date,
      kickoffTime: row.kickoff_time,
      status: row.status,
      homeScore: row.home_score,
      awayScore: row.away_score,
      homeTeamId: Array.isArray(row.home_team) ? row.home_team[0]?.id ?? null : row.home_team?.id ?? null,
      awayTeamId: Array.isArray(row.away_team) ? row.away_team[0]?.id ?? null : row.away_team?.id ?? null,
    }));
    const derived = deriveLeagueRoundData(detailedMatches);
    const roundMeta = derived.roundMeta;
    const autoSelectedRound = pickAutoRound(roundMeta, refISO);
    const selectedRound = roundOverride ?? autoSelectedRound;
    const roundMatches =
      selectedRound == null
        ? []
        : dedupeMatches(detailedMatches.filter((row) => derived.assignment.get(row.id) === selectedRound)).map((row) =>
            normalizeRuntimeMatchStatus(row, slug)
          );
    const snapshotSelectedRound = snapshot?.selectedRound ?? null;
    const snapshotMatches =
      snapshotSelectedRound == null
        ? []
        : dedupeMatches((snapshot?.matches || []) as MatchRow[]).map((row) => normalizeRuntimeMatchStatus(row, slug));
    const fallbackSelectedRound = fallback?.selectedRound ?? null;
    const fallbackMatches =
      fallbackSelectedRound == null
        ? []
        : dedupeMatches((fallback?.matches || []) as MatchRow[]).map((row) => normalizeRuntimeMatchStatus(row, slug));
    const hasStructuredKnockoutRounds = roundMeta.some((item) => Boolean(item.phaseKey || item.stageLabel));
    const useSnapshotStructure = Boolean(
      snapshot &&
        !hasStructuredKnockoutRounds &&
        (
          (roundMeta.length === 0 && (snapshot.roundMeta?.length || 0) > 0) ||
          (!roundMatches.length && snapshotMatches.length > 0) ||
          shouldPreferMoreCompleteRound(roundMatches, snapshotMatches)
        )
    );
    const useFallbackStructure = Boolean(
      fallback &&
        (
          (((useSnapshotStructure ? snapshot?.roundMeta || roundMeta : roundMeta).length === 0) && (fallback.roundMeta?.length || 0) > 0) ||
          (!(useSnapshotStructure ? snapshotMatches : roundMatches).length && fallbackMatches.length > 0) ||
          (selectedRound == null && fallbackSelectedRound != null)
        )
    );
    const baseRoundMeta = useSnapshotStructure ? snapshot?.roundMeta || roundMeta : roundMeta;
    const baseSelectedRound = useSnapshotStructure ? snapshotSelectedRound : selectedRound;
    const baseMatches = useSnapshotStructure ? mergeLeagueMatches(roundMatches, snapshotMatches) : roundMatches;
    const effectiveRoundMeta = useFallbackStructure ? fallback?.roundMeta || baseRoundMeta : baseRoundMeta;
    const effectiveSelectedRound = useFallbackStructure ? fallbackSelectedRound : baseSelectedRound;
    const matches = finalizeLeagueMatches(
      collapseLeagueMatches(
      mergeLeagueMatches(baseMatches, fallbackMatches).map((row) => normalizeRuntimeMatchStatus(row, slug))
      )
    );
    const bracketAugmented = appendSyntheticKnockoutRounds(effectiveRoundMeta, matches);
    const knockoutRoundMeta = bracketAugmented.roundMeta.filter((item) => Boolean(item.phaseKey));
    const knockoutMatches = bracketAugmented.matches.filter((row) => Boolean(parseKnockoutMetaFromSourceUrl(row.source_url).phaseKey));
    const visibleMatches = filterVisibleLeagueMatches(
      bracketAugmented.matches,
      bracketAugmented.roundMeta,
      effectiveSelectedRound
    );
    const recentForm = buildRecentForm(detailedMatches);
    const table = new Map<number, StandingsAccumulator>();
    for (const row of detailedMatches.filter((item) => item.status === "FT")) {
      const home = Array.isArray(row.home_team) ? row.home_team[0] : row.home_team;
      const away = Array.isArray(row.away_team) ? row.away_team[0] : row.away_team;
      if (home?.id && !table.has(home.id)) table.set(home.id, { teamId: home.id, team: home.name, teamSlug: home.slug ?? null, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 });
      if (away?.id && !table.has(away.id)) table.set(away.id, { teamId: away.id, team: away.name, teamSlug: away.slug ?? null, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 });
      if (!home?.id || !away?.id || row.home_score == null || row.away_score == null) continue;
      const h = table.get(home.id);
      const a = table.get(away.id);
      if (!h || !a) continue;
      h.pj += 1; a.pj += 1; h.pf += row.home_score; h.pa += row.away_score; a.pf += row.away_score; a.pa += row.home_score;
      if (row.home_score > row.away_score) { h.w += 1; h.pts += 4; a.l += 1; } else if (row.away_score > row.home_score) { a.w += 1; a.pts += 4; h.l += 1; } else { h.d += 1; a.d += 1; h.pts += 2; a.pts += 2; }
    }
    const computedStandings = Array.from(table.values()).sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.team.localeCompare(b.team)).map((row, index) => ({ ...row, position: index + 1, badge: null, form: recentForm.get(row.teamId) ?? [] }));
    const { data: standingsCache, error: standingsCacheError } = await serverSupabase
      .from("standings_cache")
      .select("team_id, position, played, won, drawn, lost, points_for, points_against, points")
      .eq("season_id", season.id)
      .eq("source", "flashscore")
      .order("position", { ascending: true });
    if (standingsCacheError) {
      console.warn("standings_cache query failed, using computed standings:", describeError(standingsCacheError));
    }
    const safeStandingsCache = (standingsCacheError ? [] : standingsCache || []) as StandingCacheRow[];
    const standingsTeamIds = Array.from(
      new Set(safeStandingsCache.map((row) => row.team_id).filter((value): value is number => Number.isInteger(value)))
    );
    const teamsById = new Map<number, { id: number; name: string; slug: string | null }>();
    if (standingsTeamIds.length > 0) {
      const { data: standingsTeams, error: standingsTeamsError } = await serverSupabase
        .from("teams")
        .select("id,name,slug")
        .in("id", standingsTeamIds);
      if (standingsTeamsError) {
        console.warn("standings teams lookup failed, using computed standings:", describeError(standingsTeamsError));
      } else {
        for (const team of standingsTeams || []) {
          teamsById.set(team.id, team);
        }
      }
    }
    const standingsFromCache = safeStandingsCache
      .map((row, index) => {
        const team = row.team_id ? teamsById.get(row.team_id) ?? null : null;
        if (!team) return null;
        return {
          position: row.position ?? index + 1,
          teamId: team.id,
          team: team.name,
          teamSlug: team.slug ?? null,
          pj: row.played ?? 0,
          w: row.won ?? 0,
          d: row.drawn ?? 0,
          l: row.lost ?? 0,
          pf: row.points_for ?? 0,
          pa: row.points_against ?? 0,
          pts: row.points ?? 0,
          badge: null,
          form: recentForm.get(team.id) ?? [],
        } satisfies StandingsAccumulator & { position: number; badge: null };
      })
      .filter(Boolean) as Array<StandingsAccumulator & { position: number; badge: null }>;
    const standingsFromSnapshot =
      snapshot?.standingsSource === "cache" && Array.isArray(snapshot.standings) && snapshot.standings.length
        ? snapshot.standings
        : [];
    const standings =
      (hasUsableStandingCache(safeStandingsCache) && standingsFromCache.length ? standingsFromCache : null) ??
      (standingsFromSnapshot.length ? standingsFromSnapshot : null) ??
      computedStandings;
    const standingsSource =
      hasUsableStandingCache(safeStandingsCache) && standingsFromCache.length
        ? "cache"
        : standingsFromSnapshot.length
          ? "cache"
          : "computed";
    return res.status(200).json({
      competition: mergedCompetition,
      noticeKey: getCompetitionNoticeKey(mergedCompetition.slug),
      profile: competitionProfile,
      regionProfile,
      season,
      competitions: mergedCompetitions,
      roundMeta: bracketAugmented.roundMeta,
      knockoutRoundMeta,
      selectedRound: effectiveSelectedRound,
      knockoutMatches,
      matches: visibleMatches || [],
      standings,
      standingsSource,
      source: "supabase",
    });
  } catch (error) {
    const snapshot = getSnapshotLeagueData(slug, refISO, roundOverride);
    if (snapshot) {
      const fallback = getFallbackLeagueData(slug, refISO, roundOverride);
      const preferFallback = shouldPreferMoreCompleteRound(
        dedupeMatches((snapshot.matches || []) as MatchRow[]),
        dedupeMatches((fallback?.matches || []) as MatchRow[])
      );
      const basePayload = preferFallback && fallback ? fallback : snapshot;
      const competitionProfile = getCompetitionProfile(basePayload.competition.slug, {
        name: basePayload.competition.name,
        country: basePayload.competition.country_code ?? undefined,
        region: basePayload.competition.region ?? undefined,
      });
      const regionProfile = getCountryProfile(competitionProfile.country ?? basePayload.competition.region);
      const snapshotMatches = finalizeLeagueMatches(
        collapseLeagueMatches(
          ((basePayload.matches || []) as MatchRow[]).map((row) => normalizeRuntimeMatchStatus(row, slug))
        )
      );
      const bracketAugmented = appendSyntheticKnockoutRounds(basePayload.roundMeta || [], snapshotMatches);
      const knockoutRoundMeta = bracketAugmented.roundMeta.filter((item) => Boolean(item.phaseKey));
      const knockoutMatches = bracketAugmented.matches.filter((row) => Boolean(parseKnockoutMetaFromSourceUrl(row.source_url).phaseKey));
      const visibleMatches = filterVisibleLeagueMatches(
        bracketAugmented.matches,
        bracketAugmented.roundMeta,
        basePayload.selectedRound
      );
      return res.status(200).json({
        ...basePayload,
        noticeKey: getCompetitionNoticeKey(basePayload.competition.slug),
        profile: competitionProfile,
        regionProfile,
        roundMeta: bracketAugmented.roundMeta,
        knockoutRoundMeta,
        knockoutMatches,
        matches: visibleMatches,
        source: preferFallback ? "snapshot+fallback" : "snapshot",
        warning: describeError(error),
      });
    }
    const fallback = getFallbackLeagueData(slug, refISO);
    if (!fallback) {
      return res.status(404).json({ error: error instanceof Error ? error.message : `No competition found for slug: ${slug}` });
    }
    const competitionProfile = getCompetitionProfile(fallback.competition.slug, {
      name: fallback.competition.name,
      country: fallback.competition.country_code ?? undefined,
      region: fallback.competition.region ?? undefined,
    });
    const regionProfile = getCountryProfile(competitionProfile.country ?? fallback.competition.region);
    return res.status(200).json({
      ...fallback,
      noticeKey: getCompetitionNoticeKey(fallback.competition.slug),
      profile: competitionProfile,
      regionProfile,
      knockoutRoundMeta: [],
      knockoutMatches: [],
      matches: finalizeLeagueMatches(
        collapseLeagueMatches(
          ((fallback.matches || []) as MatchRow[]).map((row) => normalizeRuntimeMatchStatus(row, slug))
        )
      ),
      source: "fallback",
      warning: describeError(error),
    });
  }
}
