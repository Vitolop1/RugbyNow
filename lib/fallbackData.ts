import fs from "node:fs";
import path from "node:path";

type Competition = {
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

type Season = {
  id: number;
  name: string;
  competition_id: number;
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

type DryRunRow = {
  home: string;
  away: string;
  hs: string;
  as: string;
  statusOrTime: string;
  roundText: string;
  rawText: string;
  dateLabel: string;
  sourcePage: "results" | "fixtures";
};

type DryRunDump = {
  competition: string;
  seasonName: string;
  sourceUrl: string;
  scrapedMatches: DryRunRow[];
};

const COMPETITIONS: Competition[] = [
  { id: 1, name: "Top 14", slug: "fr-top14", region: "France", country_code: "FR", group_name: "France", sort_order: 1, is_featured: true },
  { id: 2, name: "Serie A Elite", slug: "it-serie-a-elite", region: "Italy", country_code: "IT", group_name: "Italy", sort_order: 1, is_featured: false },
  { id: 3, name: "Six Nations", slug: "int-six-nations", region: "Europe", country_code: null, group_name: "International", sort_order: 1, is_featured: true },
  { id: 4, name: "Super Rugby Americas", slug: "sra", region: "South America", country_code: null, group_name: "International", sort_order: 2, is_featured: true },
  { id: 5, name: "Premiership Rugby", slug: "en-premiership-rugby", region: "England", country_code: "GB", group_name: "International", sort_order: 3, is_featured: true },
  { id: 6, name: "European Rugby Champions Cup", slug: "eu-champions-cup", region: "Europe", country_code: null, group_name: "International", sort_order: 4, is_featured: true },
  { id: 7, name: "World Cup", slug: "int-world-cup", region: "World", country_code: null, group_name: "International", sort_order: 5, is_featured: false },
  { id: 8, name: "Nations Championship", slug: "int-nations-championship", region: "World", country_code: null, group_name: "International", sort_order: 6, is_featured: false },
  { id: 9, name: "Super Rugby Pacific", slug: "int-super-rugby-pacific", region: "World", country_code: null, group_name: "International", sort_order: 7, is_featured: true },
  { id: 10, name: "URBA Top 14", slug: "ar-urba-top14", region: "Argentina", country_code: "AR", group_name: "Argentina", sort_order: 1, is_featured: true },
  { id: 11, name: "Major League Rugby", slug: "us-mlr", region: "USA", country_code: "US", group_name: "USA", sort_order: 1, is_featured: true },
];

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function parseScore(x: string) {
  const t = (x || "").trim().replace(/–/g, "-");
  if (t === "-" || t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

function detectStatus(raw: string, hs: number | null, as: number | null, sourcePage: "results" | "fixtures") {
  const s = (raw || "").toUpperCase().trim();
  if (/(POSTP|CANC|CANCEL|ABAND|ABD|AWD|WO)/.test(s)) return { status: "NS" as const, minute: null };
  if (/(FT|FINAL|AET|AFTER EXTRA TIME)/.test(s)) return { status: "FT" as const, minute: null };
  if (/(HT|HALF TIME|LIVE)/.test(s)) return { status: "LIVE" as const, minute: null };

  const minuteMatch = s.match(/\b(\d{1,3})\s*'\b/);
  if (minuteMatch) return { status: "LIVE" as const, minute: Number.parseInt(minuteMatch[1], 10) };

  const timeMatch = s.match(/\b\d{1,2}:\d{2}\b/);
  if (timeMatch) return { status: "NS" as const, minute: null };

  if (sourcePage === "results" && hs !== null && as !== null) return { status: "FT" as const, minute: null };
  return { status: "NS" as const, minute: null };
}

function inferDate(text: string, fallbackYear = new Date().getUTCFullYear()) {
  const value = text || "";

  const dotMatch = value.match(/\b(\d{1,2})\.(\d{1,2})\.?\b/);
  if (dotMatch) {
    const day = Number.parseInt(dotMatch[1], 10);
    const month = Number.parseInt(dotMatch[2], 10);
    return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const slashMatch = value.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10);
    const day = Number.parseInt(slashMatch[2], 10);
    return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const monthMap: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  const monthNameMatch = value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\b/i);
  if (monthNameMatch) {
    const month = monthMap[monthNameMatch[1].slice(0, 3).toLowerCase()];
    const day = Number.parseInt(monthNameMatch[2], 10);
    return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function inferKickoffTime(text: string) {
  const match = (text || "").match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}:00`;
}

function parseRound(raw: string) {
  const value = (raw || "").trim();
  if (!value) return null;
  const m1 = value.match(/\bround\s+(\d+)\b/i);
  if (m1) return Number.parseInt(m1[1], 10);
  const m2 = value.match(/\b(?:fecha|jornada|week)\s+(\d+)\b/i);
  if (m2) return Number.parseInt(m2[1], 10);
  const m3 = value.match(/\b(\d+)\b/);
  if (m3) return Number.parseInt(m3[1], 10);
  return null;
}

function pickAutoRound(meta: RoundMeta[], refISO: string) {
  if (!meta.length) return null;
  const rounds = meta.slice().sort((a, b) => a.round - b.round);
  const currentIndex = rounds.findIndex((r) => r.first_date <= refISO && refISO <= r.last_date);

  if (currentIndex !== -1) {
    const current = rounds[currentIndex];
    const isComplete = current.ft >= current.matches;
    const isPast = refISO > current.last_date;
    if (isComplete && isPast && rounds[currentIndex + 1]) return rounds[currentIndex + 1].round;
    return current.round;
  }

  const next = rounds.find((r) => r.first_date >= refISO);
  if (next) return next.round;

  const lastIncomplete = rounds.slice().reverse().find((r) => r.ft < r.matches);
  return (lastIncomplete ?? rounds[rounds.length - 1]).round;
}

function pointsForResult(home: number, away: number) {
  if (home > away) return { homePts: 4, awayPts: 0, homeW: 1, awayW: 0, d: 0 };
  if (away > home) return { homePts: 0, awayPts: 4, homeW: 0, awayW: 1, d: 0 };
  return { homePts: 2, awayPts: 2, homeW: 0, awayW: 0, d: 1 };
}

function dedupeRows(rows: DryRunRow[]) {
  const out: DryRunRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = [norm(row.home), norm(row.away), row.statusOrTime, row.hs, row.as, row.sourcePage].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function loadDryRunDumps(): DryRunDump[] {
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) return [];

  const files = fs
    .readdirSync(logsDir)
    .filter((file) => /^flashscore-dry-run-.*\.json$/i.test(file))
    .map((file) => path.join(logsDir, file));

  return files
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(file, "utf8")) as DryRunDump;
      } catch {
        return null;
      }
    })
    .filter((value): value is DryRunDump => value !== null);
}

export function getFallbackCompetitions() {
  return COMPETITIONS;
}

export function getFallbackSeasons() {
  return COMPETITIONS.map((competition, index): Season => ({
    id: index + 1,
    name: `dry-run-${new Date().getUTCFullYear()}`,
    competition_id: competition.id,
  }));
}

export function getFallbackMatchesByDate(date: string): HomeMatchRow[] {
  const dumps = loadDryRunDumps();
  const rows: HomeMatchRow[] = [];
  let id = 1;

  for (const dump of dumps) {
    const competition = COMPETITIONS.find((item) => item.slug === dump.competition);
    if (!competition) continue;

    for (const row of dedupeRows(dump.scrapedMatches || [])) {
      const matchDate = inferDate(row.dateLabel || row.statusOrTime || row.rawText);
      if (matchDate !== date) continue;

      const hs = parseScore(row.hs);
      const as = parseScore(row.as);
      const parsed = detectStatus(row.statusOrTime, hs, as, row.sourcePage);

      rows.push({
        id: id++,
        match_date: matchDate,
        kickoff_time: inferKickoffTime(row.statusOrTime || row.rawText),
        status: parsed.status,
        minute: parsed.minute,
        home_score: parsed.status === "NS" ? null : hs,
        away_score: parsed.status === "NS" ? null : as,
        home_team: { id: id * 10 + 1, name: row.home, slug: slugify(row.home) },
        away_team: { id: id * 10 + 2, name: row.away, slug: slugify(row.away) },
        season: {
          competition: {
            name: competition.name,
            slug: competition.slug,
            region: competition.region,
          },
        },
      });
    }
  }

  return rows.sort((a, b) => (a.kickoff_time || "").localeCompare(b.kickoff_time || ""));
}

function getFallbackLeagueMatches(compSlug: string): LeagueMatchRow[] {
  const dumps = loadDryRunDumps();
  const dump = dumps.find((item) => item.competition === compSlug);
  if (!dump) return [];

  const rows: LeagueMatchRow[] = [];
  let id = 1;

  for (const row of dedupeRows(dump.scrapedMatches || [])) {
    const matchDate = inferDate(row.dateLabel || row.statusOrTime || row.rawText);
    if (!matchDate) continue;

    const hs = parseScore(row.hs);
    const as = parseScore(row.as);
    const parsed = detectStatus(row.statusOrTime, hs, as, row.sourcePage);

    rows.push({
      id: id++,
      match_date: matchDate,
      kickoff_time: inferKickoffTime(row.statusOrTime || row.rawText),
      status: parsed.status,
      minute: parsed.minute,
      home_score: parsed.status === "NS" ? null : hs,
      away_score: parsed.status === "NS" ? null : as,
      round: parseRound(row.roundText || row.rawText),
      venue: null,
      home_team: { id: id * 10 + 1, name: row.home, slug: slugify(row.home) },
      away_team: { id: id * 10 + 2, name: row.away, slug: slugify(row.away) },
    });
  }

  const hasExplicitRounds = rows.some((row) => row.round != null);
  if (!hasExplicitRounds) {
    const orderedDates = Array.from(new Set(rows.map((row) => row.match_date))).sort((a, b) => a.localeCompare(b));
    const roundByDate = new Map(orderedDates.map((date, index) => [date, index + 1]));

    for (const row of rows) {
      row.round = roundByDate.get(row.match_date) ?? null;
    }
  }

  return rows.sort((a, b) => {
    if (a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date);
    return (a.kickoff_time || "").localeCompare(b.kickoff_time || "");
  });
}

function getFallbackRoundMeta(matches: LeagueMatchRow[]): RoundMeta[] {
  const map = new Map<number, { first: string; last: string; count: number; ft: number }>();

  for (const row of matches) {
    if (row.round == null) continue;
    const existing = map.get(row.round);
    if (!existing) {
      map.set(row.round, {
        first: row.match_date,
        last: row.match_date,
        count: 1,
        ft: row.status === "FT" ? 1 : 0,
      });
      continue;
    }

    if (row.match_date < existing.first) existing.first = row.match_date;
    if (row.match_date > existing.last) existing.last = row.match_date;
    existing.count += 1;
    if (row.status === "FT") existing.ft += 1;
  }

  return Array.from(map.entries())
    .map(([round, value]) => ({
      round,
      first_date: value.first,
      last_date: value.last,
      matches: value.count,
      ft: value.ft,
    }))
    .sort((a, b) => a.round - b.round);
}

function getFallbackStandings(compSlug: string, matches: LeagueMatchRow[]): LeagueStandingRow[] {
  const table = new Map<number, LeagueStandingRow>();

  for (const match of matches) {
    if (match.home_team?.id && !table.has(match.home_team.id)) {
      table.set(match.home_team.id, {
        teamId: match.home_team.id,
        team: match.home_team.name,
        teamSlug: match.home_team.slug,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
      });
    }

    if (match.away_team?.id && !table.has(match.away_team.id)) {
      table.set(match.away_team.id, {
        teamId: match.away_team.id,
        team: match.away_team.name,
        teamSlug: match.away_team.slug,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
      });
    }
  }

  for (const match of matches) {
    if (
      match.status !== "FT" ||
      match.home_score == null ||
      match.away_score == null ||
      !match.home_team?.id ||
      !match.away_team?.id
    ) {
      continue;
    }

    const home = table.get(match.home_team.id);
    const away = table.get(match.away_team.id);
    if (!home || !away) continue;

    home.pj += 1;
    away.pj += 1;
    home.pf += match.home_score;
    home.pa += match.away_score;
    away.pf += match.away_score;
    away.pa += match.home_score;

    const result = pointsForResult(match.home_score, match.away_score);
    home.pts += result.homePts;
    away.pts += result.awayPts;

    if (result.d === 1) {
      home.d += 1;
      away.d += 1;
    } else {
      home.w += result.homeW;
      away.w += result.awayW;
      home.l += result.awayW;
      away.l += result.homeW;
    }
  }

  return Array.from(table.values())
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const aDiff = a.pf - a.pa;
      const bDiff = b.pf - b.pa;
      if (bDiff !== aDiff) return bDiff - aDiff;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.team.localeCompare(b.team);
    })
    .map((row, index) => ({ ...row, position: index + 1, badge: null }));
}

export function getFallbackLeagueData(compSlug: string, refISO: string) {
  const competition = COMPETITIONS.find((item) => item.slug === compSlug) ?? null;
  if (!competition) return null;

  const season = {
    id: competition.id,
    name: `dry-run-${new Date().getUTCFullYear()}`,
    competition_id: competition.id,
  };

  const allMatches = getFallbackLeagueMatches(compSlug);
  const roundMeta = getFallbackRoundMeta(allMatches);
  const selectedRound = pickAutoRound(roundMeta, refISO);
  const matches = selectedRound == null ? [] : allMatches.filter((row) => row.round === selectedRound);
  const standings = getFallbackStandings(compSlug, allMatches);

  return {
    competition,
    season,
    competitions: COMPETITIONS,
    roundMeta,
    selectedRound,
    matches,
    standings,
  };
}
