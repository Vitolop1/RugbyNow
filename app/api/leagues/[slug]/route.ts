import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackLeagueData } from "@/lib/fallbackData";
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
  position: number | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points: number | null;
  team:
    | { id: number; name: string; slug: string | null }
    | { id: number; name: string; slug: string | null }[]
    | null;
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
  status: "NS" | "LIVE" | "FT";
};

type MatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: "NS" | "LIVE" | "FT";
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue?: string | null;
  home_team: { id: number; name: string; slug: string | null } | { id: number; name: string; slug: string | null }[] | null;
  away_team: { id: number; name: string; slug: string | null } | { id: number; name: string; slug: string | null }[] | null;
};

function seasonSortKey(name: string) {
  const s = (name || "").trim();
  const mRange = s.match(/\b(\d{4})\s*\/\s*(\d{2,4})\b/);
  if (mRange) {
    const a = Number.parseInt(mRange[1], 10);
    const bRaw = mRange[2];
    const b =
      bRaw.length === 2
        ? Number.parseInt(`${mRange[1].slice(0, 2)}${bRaw}`, 10)
        : Number.parseInt(bRaw, 10);
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
  const summaries = seasons
    .map((season) => {
      const seasonMatches = matches.filter((row) => row.season_id === season.id);
      if (!seasonMatches.length) return { season, count: 0, distance: Number.POSITIVE_INFINITY, first: "", last: "" };
      const dates = seasonMatches.map((row) => row.match_date).sort();
      const first = dates[0];
      const last = dates[dates.length - 1];
      return {
        season,
        count: seasonMatches.length,
        distance: rangeDistanceDays(refISO, first, last),
        first,
        last,
      };
    })
    .sort((a, b) => {
      if (!!a.count !== !!b.count) return a.count ? -1 : 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.last !== b.last) return b.last.localeCompare(a.last);
      return seasonSortKey(b.season.name) - seasonSortKey(a.season.name);
    });

  return summaries[0]?.season ?? seasons.slice().sort((a, b) => seasonSortKey(b.name) - seasonSortKey(a.name))[0] ?? null;
}

function deriveRoundMeta<T extends { id: number; match_date: string; kickoff_time: string | null; status: string }>(rows: T[]) {
  const sorted = rows
    .slice()
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) ||
        String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || ""))
    );

  const roundMap = new Map<number, { first_date: string; last_date: string; matches: number; ft: number }>();
  const assignment = new Map<number, number>();

  let currentRound = 0;
  let lastDate: string | null = null;

  for (const row of sorted) {
    const gapDays =
      lastDate == null
        ? Number.POSITIVE_INFINITY
        : Math.round(
            (new Date(`${row.match_date}T00:00:00Z`).getTime() - new Date(`${lastDate}T00:00:00Z`).getTime()) / 86400000
          );

    if (lastDate == null || gapDays > 4) {
      currentRound += 1;
      roundMap.set(currentRound, {
        first_date: row.match_date,
        last_date: row.match_date,
        matches: 0,
        ft: 0,
      });
    }

    lastDate = row.match_date;
    assignment.set(row.id, currentRound);
    const meta = roundMap.get(currentRound)!;
    meta.last_date = row.match_date;
    meta.matches += 1;
    if (row.status === "FT") meta.ft += 1;
  }

  return {
    assignment,
    roundMeta: Array.from(roundMap.entries()).map(([round, meta]) => ({ round, ...meta })),
  };
}

function pickAutoRound(
  roundMeta: Array<{ round: number; first_date: string; last_date: string; matches: number; ft: number }>,
  refISO: string
) {
  if (!roundMeta.length) return null;
  const current = roundMeta.find((item) => item.first_date <= refISO && refISO <= item.last_date);
  if (current) return current.round;
  const next = roundMeta.find((item) => item.first_date >= refISO);
  if (next) return next.round;
  return roundMeta[roundMeta.length - 1]?.round ?? null;
}

function buildRecentForm(rows: MatchRow[]) {
  const formMap = new Map<number, Array<"W" | "D" | "L">>();
  const sorted = rows
    .filter((item) => item.status === "FT" && item.home_score != null && item.away_score != null)
    .slice()
    .sort(
      (a, b) =>
        b.match_date.localeCompare(a.match_date) ||
        String(b.kickoff_time || "").localeCompare(String(a.kickoff_time || ""))
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const refISO =
    request.nextUrl.searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(request.nextUrl.searchParams.get("date") || "")
      ? (request.nextUrl.searchParams.get("date") as string)
      : new Date().toISOString().slice(0, 10);
  const roundOverrideRaw = request.nextUrl.searchParams.get("round");
  const roundOverride =
    roundOverrideRaw && /^\d+$/.test(roundOverrideRaw) ? Number.parseInt(roundOverrideRaw, 10) : null;

  try {
    const { data: competition, error: competitionError } = await serverSupabase
      .from("competitions")
      .select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured")
      .eq("slug", slug)
      .maybeSingle();

    if (competitionError || !competition) throw new Error(`No competition found for slug: ${slug}`);

    const { data: seasons, error: seasonsError } = await serverSupabase
      .from("seasons")
      .select("id,name,competition_id")
      .eq("competition_id", competition.id)
      .order("name", { ascending: false });

    if (seasonsError || !seasons?.length) throw new Error(`No season found for: ${slug}`);

    const { data: seasonMatchMeta, error: seasonMetaError } = await serverSupabase
      .from("matches")
      .select("id,season_id,match_date,kickoff_time,status")
      .in(
        "season_id",
        seasons.map((row) => row.id)
      )
      .order("match_date", { ascending: true })
      .order("kickoff_time", { ascending: true });

    if (seasonMetaError) throw seasonMetaError;

    const season = pickSeasonForReference((seasons || []) as SeasonRow[], (seasonMatchMeta || []) as MatchMetaRow[], refISO);
    if (!season) throw new Error(`No season found for: ${slug}`);

    const { data: competitions, error: competitionsError } = await serverSupabase
      .from("competitions")
      .select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured")
      .order("is_featured", { ascending: false })
      .order("group_name", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (competitionsError) throw competitionsError;

    const { data: seasonMatches, error: seasonMatchesError } = await serverSupabase
      .from("matches")
      .select(`
        id, match_date, kickoff_time, status, minute, home_score, away_score, round, venue,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug )
      `)
      .eq("season_id", season.id)
      .order("match_date", { ascending: true });

    if (seasonMatchesError) throw seasonMatchesError;

    const detailedMatches = (seasonMatches || []) as MatchRow[];
    const derived = deriveRoundMeta(detailedMatches);
    const roundMeta = derived.roundMeta;
    const autoSelectedRound = pickAutoRound(roundMeta, refISO);
    const selectedRound = roundOverride ?? autoSelectedRound;

    const matches =
      selectedRound == null
        ? []
        : detailedMatches.filter((row) => derived.assignment.get(row.id) === selectedRound);

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
      h.pj += 1; a.pj += 1;
      h.pf += row.home_score; h.pa += row.away_score;
      a.pf += row.away_score; a.pa += row.home_score;
      if (row.home_score > row.away_score) { h.w += 1; h.pts += 4; a.l += 1; }
      else if (row.away_score > row.home_score) { a.w += 1; a.pts += 4; h.l += 1; }
      else { h.d += 1; a.d += 1; h.pts += 2; a.pts += 2; }
    }

    const computedStandings = Array.from(table.values())
      .sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.team.localeCompare(b.team))
      .map((row, index) => ({ ...row, position: index + 1, badge: null, form: recentForm.get(row.teamId) ?? [] }));

    const { data: standingsCache, error: standingsCacheError } = await serverSupabase
      .from("standings_cache")
      .select(`
        position, played, won, drawn, lost, points_for, points_against, points,
        team:team_id ( id, name, slug )
      `)
      .eq("season_id", season.id)
      .eq("source", "flashscore")
      .order("position", { ascending: true });

    if (standingsCacheError) throw standingsCacheError;

    const standings =
      (standingsCache || []).length > 0
        ? ((standingsCache as StandingCacheRow[])
            .map((row, index) => {
              const team = Array.isArray(row.team) ? row.team[0] : row.team;
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
            .filter(Boolean) as Array<StandingsAccumulator & { position: number; badge: null }>)
        : computedStandings;

    return NextResponse.json({
      competition,
      season,
      competitions: competitions || [],
      roundMeta,
      selectedRound,
      matches: matches || [],
      standings,
      standingsSource: (standingsCache || []).length > 0 ? "cache" : "computed",
      source: "supabase",
    });
  } catch (error) {
    const snapshot = getSnapshotLeagueData(slug, refISO, roundOverride);
    if (snapshot) {
      return NextResponse.json({
        ...snapshot,
        source: "snapshot",
        warning: error instanceof Error ? error.message : String(error),
      });
    }

    const fallback = getFallbackLeagueData(slug, refISO);
    if (!fallback) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : `No competition found for slug: ${slug}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...fallback,
      source: "fallback",
      warning: error instanceof Error ? error.message : String(error),
    });
  }
}
