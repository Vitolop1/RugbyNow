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

type SnapshotPayload = {
  generatedAt: string;
  competitions: SnapshotCompetition[];
  seasons: SnapshotSeason[];
  teams: SnapshotTeam[];
  matches: SnapshotMatch[];
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
  const roundMap = new Map<number, { first: string; last: string; count: number; ft: number }>();

  for (const row of matches) {
    const round = typeof row.round === "number" ? row.round : Number.parseInt(String(row.round), 10);
    if (!Number.isFinite(round)) continue;
    const current = roundMap.get(round);
    const date = String(row.match_date);
    const isFt = row.status === "FT";
    if (!current) {
      roundMap.set(round, { first: date, last: date, count: 1, ft: isFt ? 1 : 0 });
    } else {
      if (date < current.first) current.first = date;
      if (date > current.last) current.last = date;
      current.count += 1;
      if (isFt) current.ft += 1;
    }
  }

  return Array.from(roundMap.entries())
    .map(([round, value]) => ({
      round,
      first_date: value.first,
      last_date: value.last,
      matches: value.count,
      ft: value.ft,
    }))
    .sort((a, b) => a.round - b.round);
}

function buildStandings(snapshot: SnapshotPayload, matches: SnapshotMatch[]): LeagueStandingRow[] {
  const teams = getTeamMap(snapshot);
  const table = new Map<number, LeagueStandingRow>();

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
    .map((row, index) => ({ ...row, position: index + 1, badge: null }));
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

  const competitionSeasons = snapshot.seasons
    .filter((season) => season.competition_id === competition.id)
    .sort((a, b) => seasonSortKey(b.name) - seasonSortKey(a.name));
  const season = competitionSeasons[0];
  if (!season) return null;

  const seasonMatches = snapshot.matches.filter((match) => match.season_id === season.id);
  const roundMeta = buildRoundMeta(seasonMatches);
  const autoSelectedRound =
    roundMeta.find((item) => item.first_date <= refISO && refISO <= item.last_date)?.round ??
    roundMeta.find((item) => item.first_date >= refISO)?.round ??
    roundMeta[0]?.round ??
    null;
  const selectedRound = roundOverride ?? autoSelectedRound;

  const matches = seasonMatches
    .filter((match) => match.round === selectedRound)
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) || String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || ""))
    )
    .map((match) => hydrateLeagueMatch(snapshot, match))
    .filter((match): match is LeagueMatchRow => Boolean(match));

  return {
    competition,
    season,
    competitions: getSnapshotCompetitions() || [],
    roundMeta,
    selectedRound,
    matches,
    standings: buildStandings(snapshot, seasonMatches),
    generatedAt: snapshot.generatedAt,
  };
}
