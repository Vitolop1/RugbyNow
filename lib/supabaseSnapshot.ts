import fs from "node:fs";
import path from "node:path";

type SnapshotCompetition = {
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

type SnapshotSeason = {
  id: number;
  name: string;
  competition_id: number;
};

type SnapshotTeam = {
  id: number;
  name: string;
  slug: string | null;
};

type SnapshotMatch = {
  id: number;
  season_id: number;
  match_date: string;
  kickoff_time: string | null;
  status: "NS" | "LIVE" | "FT";
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
};

type SnapshotStandingCache = {
  season_id: number;
  team_id: number;
  position: number | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points: number | null;
  source?: string | null;
  updated_at?: string | null;
};

type SnapshotPayload = {
  generatedAt: string;
  competitions: SnapshotCompetition[];
  seasons: SnapshotSeason[];
  teams: SnapshotTeam[];
  matches: SnapshotMatch[];
  standings_cache: SnapshotStandingCache[];
};

type HomeMatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: "NS" | "LIVE" | "FT";
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: number; name: string; slug: string } | null;
  away_team: { id: number; name: string; slug: string } | null;
  season: {
    competition: {
      name: string;
      slug: string;
      region: string | null;
    } | null;
  } | null;
};

type LeagueMatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: "NS" | "LIVE" | "FT";
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue: string | null;
  home_team: { id: number; name: string; slug: string } | null;
  away_team: { id: number; name: string; slug: string } | null;
};

type LeagueStandingRow = {
  teamId: number;
  team: string;
  teamSlug?: string | null;
  pj: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pts: number;
  position?: number;
  badge?: "champions" | "europe" | "relegation" | null;
  form?: Array<"W" | "D" | "L">;
};

type RoundMeta = {
  round: number;
  first_date: string;
  last_date: string;
  matches: number;
  ft: number;
};

let cachedSnapshot: SnapshotPayload | null | undefined;

function snapshotPath() {
  return path.join(process.cwd(), "data", "supabase-snapshot.json");
}

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

function loadSnapshot() {
  if (cachedSnapshot !== undefined) return cachedSnapshot;

  try {
    const raw = fs.readFileSync(snapshotPath(), "utf8");
    cachedSnapshot = JSON.parse(raw) as SnapshotPayload;
  } catch {
    cachedSnapshot = null;
  }

  return cachedSnapshot;
}

function getTeamMap(snapshot: SnapshotPayload) {
  return new Map(snapshot.teams.map((team) => [team.id, team]));
}

function getSeasonMap(snapshot: SnapshotPayload) {
  return new Map(snapshot.seasons.map((season) => [season.id, season]));
}

function getCompetitionMap(snapshot: SnapshotPayload) {
  return new Map(snapshot.competitions.map((competition) => [competition.id, competition]));
}

function hydrateHomeMatch(snapshot: SnapshotPayload, match: SnapshotMatch): HomeMatchRow | null {
  const teams = getTeamMap(snapshot);
  const seasons = getSeasonMap(snapshot);
  const competitions = getCompetitionMap(snapshot);

  const season = seasons.get(match.season_id);
  const competition = season ? competitions.get(season.competition_id) ?? null : null;
  const home = match.home_team_id ? teams.get(match.home_team_id) ?? null : null;
  const away = match.away_team_id ? teams.get(match.away_team_id) ?? null : null;

  if (!competition || !home || !away) return null;

  return {
    id: match.id,
    match_date: match.match_date,
    kickoff_time: match.kickoff_time,
    status: match.status,
    minute: match.minute,
    home_score: match.home_score,
    away_score: match.away_score,
    home_team: { id: home.id, name: home.name, slug: home.slug || "" },
    away_team: { id: away.id, name: away.name, slug: away.slug || "" },
    season: {
      competition: {
        name: competition.name,
        slug: competition.slug,
        region: competition.region,
      },
    },
  };
}

function hydrateLeagueMatch(snapshot: SnapshotPayload, match: SnapshotMatch): LeagueMatchRow | null {
  const teams = getTeamMap(snapshot);
  const home = match.home_team_id ? teams.get(match.home_team_id) ?? null : null;
  const away = match.away_team_id ? teams.get(match.away_team_id) ?? null : null;
  if (!home || !away) return null;

  return {
    id: match.id,
    match_date: match.match_date,
    kickoff_time: match.kickoff_time,
    status: match.status,
    minute: match.minute,
    home_score: match.home_score,
    away_score: match.away_score,
    round: match.round,
    venue: match.venue,
    home_team: { id: home.id, name: home.name, slug: home.slug || "" },
    away_team: { id: away.id, name: away.name, slug: away.slug || "" },
  };
}

function buildRoundMeta(matches: SnapshotMatch[]): RoundMeta[] {
  const sorted = matches
    .slice()
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) ||
        String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || ""))
    );

  const roundMap = new Map<number, { first_date: string; last_date: string; matches: number; ft: number }>();
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
    const meta = roundMap.get(currentRound)!;
    meta.last_date = row.match_date;
    meta.matches += 1;
    if (row.status === "FT") meta.ft += 1;
  }

  return Array.from(roundMap.entries()).map(([round, meta]) => ({ round, ...meta }));
}

function buildRoundAssignment(matches: SnapshotMatch[]) {
  const sorted = matches
    .slice()
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) ||
        String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || ""))
    );

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
    if (lastDate == null || gapDays > 4) currentRound += 1;
    lastDate = row.match_date;
    assignment.set(row.id, currentRound);
  }

  return assignment;
}

function pickSeasonForReference(snapshot: SnapshotPayload, competitionId: number, refISO: string) {
  const seasons = snapshot.seasons.filter((season) => season.competition_id === competitionId);
  if (!seasons.length) return null;

  const summaries = seasons
    .map((season) => {
      const seasonMatches = snapshot.matches.filter((match) => match.season_id === season.id);
      if (!seasonMatches.length) {
        return { season, count: 0, distance: Number.POSITIVE_INFINITY, last: "" };
      }
      const dates = seasonMatches.map((match) => match.match_date).sort();
      const first = dates[0];
      const last = dates[dates.length - 1];
      const ref = new Date(`${refISO}T00:00:00Z`).getTime();
      const firstTs = new Date(`${first}T00:00:00Z`).getTime();
      const lastTs = new Date(`${last}T00:00:00Z`).getTime();
      const distance =
        ref < firstTs ? (firstTs - ref) / 86400000 : ref > lastTs ? (ref - lastTs) / 86400000 : 0;
      return { season, count: seasonMatches.length, distance, last };
    })
    .sort((a, b) => {
      if (!!a.count !== !!b.count) return a.count ? -1 : 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.last !== b.last) return b.last.localeCompare(a.last);
      return seasonSortKey(b.season.name) - seasonSortKey(a.season.name);
    });

  return summaries[0]?.season ?? seasons.slice().sort((a, b) => seasonSortKey(b.name) - seasonSortKey(a.name))[0];
}

function pickAutoRound(roundMeta: RoundMeta[], refISO: string) {
  if (!roundMeta.length) return null;
  const current = roundMeta.find((item) => item.first_date <= refISO && refISO <= item.last_date);
  if (current) return current.round;
  const next = roundMeta.find((item) => item.first_date >= refISO);
  if (next) return next.round;
  return roundMeta[roundMeta.length - 1]?.round ?? null;
}

function buildStandingsFromMatches(snapshot: SnapshotPayload, matches: SnapshotMatch[]): LeagueStandingRow[] {
  const teams = getTeamMap(snapshot);
  const table = new Map<number, LeagueStandingRow>();
  const recentForm = buildRecentForm(snapshot, matches);

  for (const row of matches.filter((match) => match.status === "FT")) {
    const home = row.home_team_id ? teams.get(row.home_team_id) ?? null : null;
    const away = row.away_team_id ? teams.get(row.away_team_id) ?? null : null;
    if (!home || !away) continue;

    if (!table.has(home.id)) {
      table.set(home.id, {
        teamId: home.id,
        team: home.name,
        teamSlug: home.slug,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
      });
    }

    if (!table.has(away.id)) {
      table.set(away.id, {
        teamId: away.id,
        team: away.name,
        teamSlug: away.slug,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
      });
    }

    if (row.home_score == null || row.away_score == null) continue;

    const h = table.get(home.id)!;
    const a = table.get(away.id)!;

    h.pj += 1;
    a.pj += 1;
    h.pf += row.home_score;
    h.pa += row.away_score;
    a.pf += row.away_score;
    a.pa += row.home_score;

    if (row.home_score > row.away_score) {
      h.w += 1;
      h.pts += 4;
      a.l += 1;
    } else if (row.away_score > row.home_score) {
      a.w += 1;
      a.pts += 4;
      h.l += 1;
    } else {
      h.d += 1;
      a.d += 1;
      h.pts += 2;
      a.pts += 2;
    }
  }

  return Array.from(table.values())
    .sort(
      (a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.team.localeCompare(b.team)
    )
    .map((row, index) => ({ ...row, position: index + 1, badge: null, form: recentForm.get(row.teamId) ?? [] }));
}

function buildRecentForm(snapshot: SnapshotPayload, matches: SnapshotMatch[]) {
  const teams = getTeamMap(snapshot);
  const formMap = new Map<number, Array<"W" | "D" | "L">>();

  const sorted = matches
    .filter((match) => match.status === "FT" && match.home_score != null && match.away_score != null)
    .slice()
    .sort(
      (a, b) =>
        b.match_date.localeCompare(a.match_date) || String(b.kickoff_time || "").localeCompare(String(a.kickoff_time || ""))
    );

  for (const row of sorted) {
    const home = row.home_team_id ? teams.get(row.home_team_id) ?? null : null;
    const away = row.away_team_id ? teams.get(row.away_team_id) ?? null : null;
    if (!home || !away || row.home_score == null || row.away_score == null) continue;

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

function buildStandingsCache(snapshot: SnapshotPayload, seasonId: number, matches: SnapshotMatch[]) {
  const teams = getTeamMap(snapshot);
  const rows = (snapshot.standings_cache || [])
    .filter((row) => row.season_id === seasonId)
    .slice()
    .sort((a, b) => {
      const posA = a.position ?? 999;
      const posB = b.position ?? 999;
      if (posA !== posB) return posA - posB;
      return (b.points ?? 0) - (a.points ?? 0);
    });

  if (!rows.length) return null;

  const recentForm = buildRecentForm(snapshot, matches);

  return rows
    .map((row, index) => {
      const team = teams.get(row.team_id);
      if (!team) return null;

      return {
        teamId: row.team_id,
        team: team.name,
        teamSlug: team.slug ?? null,
        pj: row.played ?? 0,
        w: row.won ?? 0,
        d: row.drawn ?? 0,
        l: row.lost ?? 0,
        pf: row.points_for ?? 0,
        pa: row.points_against ?? 0,
        pts: row.points ?? 0,
        position: row.position ?? index + 1,
        badge: null,
        form: recentForm.get(row.team_id) ?? [],
      } satisfies LeagueStandingRow;
    })
    .filter(Boolean) as LeagueStandingRow[];
}

export function getSnapshotCompetitions() {
  const snapshot = loadSnapshot();
  if (!snapshot) return null;
  return snapshot.competitions
    .slice()
    .sort((a, b) => {
      const featuredA = a.is_featured ? 1 : 0;
      const featuredB = b.is_featured ? 1 : 0;
      if (featuredA !== featuredB) return featuredB - featuredA;
      return (
        String(a.group_name || "").localeCompare(String(b.group_name || "")) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        a.name.localeCompare(b.name)
      );
    });
}

export function getSnapshotSeasons() {
  const snapshot = loadSnapshot();
  if (!snapshot) return null;
  return snapshot.seasons.slice();
}

export function getSnapshotMatchesByDate(date: string) {
  const snapshot = loadSnapshot();
  if (!snapshot) return null;
  return snapshot.matches
    .filter((match) => match.match_date === date)
    .sort((a, b) => String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || "")))
    .map((match) => hydrateHomeMatch(snapshot, match))
    .filter((match): match is HomeMatchRow => Boolean(match));
}

export function getSnapshotLeagueData(slug: string, refISO: string, roundOverride: number | null = null) {
  const snapshot = loadSnapshot();
  if (!snapshot) return null;

  const competition = snapshot.competitions.find((item) => item.slug === slug);
  if (!competition) return null;

  const season = pickSeasonForReference(snapshot, competition.id, refISO);
  if (!season) return null;

  const seasonMatches = snapshot.matches.filter((match) => match.season_id === season.id);
  const roundMeta = buildRoundMeta(seasonMatches);
  const roundAssignment = buildRoundAssignment(seasonMatches);
  const autoSelectedRound = pickAutoRound(roundMeta, refISO);
  const selectedRound = roundOverride ?? autoSelectedRound;

  const matches = seasonMatches
    .filter((match) => roundAssignment.get(match.id) === selectedRound)
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) || String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || ""))
    )
    .map((match) => hydrateLeagueMatch(snapshot, match))
    .filter((match): match is LeagueMatchRow => Boolean(match));

  const cachedStandings = buildStandingsCache(snapshot, season.id, seasonMatches);

  return {
    competition,
    season,
    competitions: getSnapshotCompetitions() || [],
    roundMeta,
    selectedRound,
    matches,
    standings: cachedStandings ?? buildStandingsFromMatches(snapshot, seasonMatches),
    standingsSource: cachedStandings ? "cache" : "computed",
    generatedAt: snapshot.generatedAt,
  };
}
