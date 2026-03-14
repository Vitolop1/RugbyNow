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
  status: "NS" | "LIVE" | "HT" | "FT" | "CANC";
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
  status: "NS" | "LIVE" | "HT" | "FT" | "CANC";
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
  phaseKey?: string | null;
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

type JsonlRow = {
  round: number | null;
  home: string;
  away: string;
  home_score: number | null;
  away_score: number | null;
  status: "NS" | "LIVE" | "HT" | "FT" | "CANC";
  kickoff_time: string | null;
  match_date: string;
  source_event_key?: string | null;
};

const COMPETITIONS: Competition[] = [
  { id: 1, name: "Top 14", slug: "fr-top14", region: "France", country_code: "FR", group_name: "France", sort_order: 1, is_featured: true },
  { id: 2, name: "Serie A Elite", slug: "it-serie-a-elite", region: "Italy", country_code: "IT", group_name: "Italy", sort_order: 1, is_featured: false },
  { id: 3, name: "Six Nations", slug: "int-six-nations", region: "Europe", country_code: null, group_name: "Europe", sort_order: 1, is_featured: true },
  { id: 4, name: "Super Rugby Americas", slug: "sra", region: "South America", country_code: null, group_name: "South America", sort_order: 2, is_featured: true },
  { id: 5, name: "Premiership Rugby", slug: "en-premiership-rugby", region: "England", country_code: "GB", group_name: "Europe", sort_order: 3, is_featured: true },
  { id: 6, name: "European Rugby Champions Cup", slug: "eu-champions-cup", region: "Europe", country_code: null, group_name: "Europe", sort_order: 4, is_featured: true },
  { id: 7, name: "World Cup", slug: "int-world-cup", region: "World", country_code: null, group_name: "International", sort_order: 5, is_featured: false },
  { id: 8, name: "Nations Championship", slug: "int-nations-championship", region: "World", country_code: null, group_name: "International", sort_order: 6, is_featured: false },
  { id: 9, name: "Super Rugby Pacific", slug: "int-super-rugby-pacific", region: "World", country_code: null, group_name: "International", sort_order: 7, is_featured: true },
  { id: 10, name: "URBA Top 14", slug: "ar-urba-top14", region: "Argentina", country_code: "AR", group_name: "Argentina", sort_order: 1, is_featured: true },
  { id: 11, name: "Major League Rugby", slug: "us-mlr", region: "USA", country_code: "US", group_name: "USA", sort_order: 1, is_featured: true },
  { id: 12, name: "Norte Grande", slug: "ar-liga-norte-grande", region: "Argentina", country_code: "AR", group_name: "Argentina", sort_order: 2, is_featured: false },
  { id: 13, name: "United Rugby Championship", slug: "int-united-rugby-championship", region: "Europe", country_code: null, group_name: "Europe", sort_order: 5, is_featured: false },
  { id: 14, name: "SVNS Australia", slug: "svns-australia", region: "World", country_code: null, group_name: "Seven", sort_order: 1, is_featured: false },
  { id: 15, name: "SVNS USA", slug: "svns-usa", region: "World", country_code: null, group_name: "Seven", sort_order: 2, is_featured: false },
  { id: 16, name: "SVNS Hong Kong", slug: "svns-hong-kong", region: "World", country_code: null, group_name: "Seven", sort_order: 3, is_featured: false },
  { id: 17, name: "SVNS Singapore", slug: "svns-singapore", region: "World", country_code: null, group_name: "Seven", sort_order: 4, is_featured: false },
];

const STATIC_JSONL_ROWS: Record<string, JsonlRow[]> = {
  sra: [
    { round: 4, home: "Tarucas", away: "Pampas XV", home_score: 22, away_score: 43, status: "FT", kickoff_time: "20:00:00", match_date: "2026-03-13" },
    { round: 4, home: "Penarol", away: "Cobras", home_score: 40, away_score: 20, status: "FT", kickoff_time: "22:00:00", match_date: "2026-03-13" },
    { round: 4, home: "Dogos XV", away: "Selknam", home_score: null, away_score: null, status: "NS", kickoff_time: "23:30:00", match_date: "2026-03-14" },
    { round: 4, home: "Yacare XV", away: "Capibaras XV", home_score: null, away_score: null, status: "NS", kickoff_time: "21:30:00", match_date: "2026-03-14" },
  ],
  "ar-liga-norte-grande": [
    { round: 1, home: "Universitario de Salta", away: "Tiro Federal de Salta", home_score: 31, away_score: 24, status: "FT", kickoff_time: "19:30:00", match_date: "2026-03-07" },
    { round: 1, home: "Santiago Lawn Tennis Club", away: "Tigres RC", home_score: 28, away_score: 20, status: "FT", kickoff_time: "19:30:00", match_date: "2026-03-07" },
    { round: 1, home: "Gimnasia y Tiro", away: "Jockey Club de Salta", home_score: 19, away_score: 22, status: "FT", kickoff_time: "19:30:00", match_date: "2026-03-07" },
    { round: 1, home: "Santiago Rugby Club", away: "Old Lions RC", home_score: 27, away_score: 23, status: "FT", kickoff_time: "19:30:00", match_date: "2026-03-07" },

    { round: 2, home: "Universitario de Salta", away: "Tiro Federal de Salta", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-14" },
    { round: 2, home: "Santiago Lawn Tennis Club", away: "Tigres RC", home_score: 16, away_score: 7, status: "LIVE", kickoff_time: "19:30:00", match_date: "2026-03-14" },
    { round: 2, home: "Gimnasia y Tiro", away: "Jockey Club de Salta", home_score: 3, away_score: 7, status: "LIVE", kickoff_time: "19:30:00", match_date: "2026-03-14" },
    { round: 2, home: "Santiago Rugby Club", away: "Old Lions RC", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-14" },

    { round: 3, home: "Old Lions RC", away: "Universitario de Salta", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-21" },
    { round: 3, home: "Jockey Club de Salta", away: "Santiago Lawn Tennis Club", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-21" },
    { round: 3, home: "Tigres RC", away: "Gimnasia y Tiro", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-21" },
    { round: 3, home: "Tiro Federal de Salta", away: "Santiago Rugby Club", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-21" },

    { round: 4, home: "Universitario de Salta", away: "Jockey Club de Salta", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-28" },
    { round: 4, home: "Santiago Lawn Tennis Club", away: "Gimnasia y Tiro", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-28" },
    { round: 4, home: "Tigres RC", away: "Santiago Rugby Club", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-28" },
    { round: 4, home: "Tiro Federal de Salta", away: "Old Lions RC", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-03-28" },

    { round: 5, home: "Old Lions RC", away: "Santiago Lawn Tennis Club", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-04-04" },
    { round: 5, home: "Jockey Club de Salta", away: "Tigres RC", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-04-04" },
    { round: 5, home: "Gimnasia y Tiro", away: "Tiro Federal de Salta", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-04-04" },
    { round: 5, home: "Santiago Rugby Club", away: "Universitario de Salta", home_score: null, away_score: null, status: "NS", kickoff_time: "19:30:00", match_date: "2026-04-04" },
  ],
};

const CURATED_ONLY_COMPETITIONS = new Set(["sra", "ar-liga-norte-grande"]);

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
  if (/(POSTP|CANC|CANCEL|ABAND|ABD|AWD|WO)/.test(s)) return { status: "CANC" as const, minute: null };
  if (/(FT|FINAL|AET|AFTER EXTRA TIME)/.test(s)) return { status: "FT" as const, minute: null };
  if (/(HT|HALF TIME|BREAK)/.test(s)) return { status: "HT" as const, minute: null };
  if (/(LIVE|1ST HALF|2ND HALF|SECOND HALF)/.test(s)) return { status: "LIVE" as const, minute: null };

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

function attachKnockoutPhaseMeta(meta: RoundMeta[]) {
  const labels: Record<number, string> = {
    1: "final",
    2: "semifinal",
    4: "quarterfinal",
    8: "round16",
    16: "round32",
  };

  const counts = new Set(meta.map((item) => item.matches));
  const hasFinal = counts.has(1);

  return meta.map((item) => {
    const smallerRounds = meta.filter((candidate) => candidate.round > item.round && candidate.matches < item.matches);
    const allPowerOfTwo =
      item.matches > 0 &&
      (item.matches & (item.matches - 1)) === 0 &&
      smallerRounds.every((candidate) => candidate.matches > 0 && (candidate.matches & (candidate.matches - 1)) === 0);

    if (!hasFinal || !allPowerOfTwo || !labels[item.matches]) {
      return { ...item, phaseKey: null };
    }

    return { ...item, phaseKey: labels[item.matches] };
  });
}

function pointsForResult(home: number, away: number) {
  if (home > away) return { homePts: 4, awayPts: 0, homeW: 1, awayW: 0, d: 0 };
  if (away > home) return { homePts: 0, awayPts: 4, homeW: 0, awayW: 1, d: 0 };
  return { homePts: 2, awayPts: 2, homeW: 0, awayW: 0, d: 1 };
}

function countDateTokens(text: string) {
  const value = text || "";
  const dotMatches = value.match(/\b\d{1,2}\.\d{1,2}\.?\b/g) ?? [];
  const slashMatches = value.match(/\b\d{1,2}\/\d{1,2}\b/g) ?? [];
  const monthMatches =
    value.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/gi) ?? [];
  return dotMatches.length + slashMatches.length + monthMatches.length;
}

function dedupeRows(rows: DryRunRow[]) {
  const seen = new Map<string, DryRunRow>();

  for (const row of rows) {
    if (countDateTokens(row.rawText) > 1) continue;

    const key = [norm(row.home), norm(row.away), row.statusOrTime, row.hs, row.as, row.sourcePage].join("|");
    const current = seen.get(key);

    if (!current) {
      seen.set(key, row);
      continue;
    }

    const currentScore = (current.roundText ? 4 : 0) + (current.dateLabel ? 2 : 0) - current.rawText.length;
    const nextScore = (row.roundText ? 4 : 0) + (row.dateLabel ? 2 : 0) - row.rawText.length;
    if (nextScore > currentScore) seen.set(key, row);
  }

  return Array.from(seen.values());
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

function loadJsonlRowsByCompetition() {
  const logsDir = path.join(process.cwd(), "logs");
  const out = new Map<string, JsonlRow[]>(
    Object.entries(STATIC_JSONL_ROWS).map(([competition, rows]) => [competition, rows.slice()])
  );

  if (!fs.existsSync(logsDir)) return out;

  const latestByCompetition = new Map<string, { file: string; stamp: string }>();

  for (const file of fs.readdirSync(logsDir)) {
    const match = file.match(/^flashscore_(.+?)_\d{4}-\d{4}_(.*)\.jsonl$/i);
    if (!match) continue;
    const competition = match[1];
    if (CURATED_ONLY_COMPETITIONS.has(competition)) continue;
    const stamp = match[2];
    const current = latestByCompetition.get(competition);
    if (!current || stamp > current.stamp) {
      latestByCompetition.set(competition, { file: path.join(logsDir, file), stamp });
    }
  }

  for (const [competition, entry] of latestByCompetition.entries()) {
    try {
      const rows = fs
        .readFileSync(entry.file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as JsonlRow);
      out.set(competition, dedupeJsonlRows(rows));
    } catch {
      if (!out.has(competition)) out.set(competition, []);
    }
  }

  return out;
}

function compareJsonlPreference(a: JsonlRow, b: JsonlRow) {
  const score = (row: JsonlRow) => {
    let value = 0;
    if (row.status === "FT") value += 8;
    else if (row.status === "LIVE" || row.status === "HT") value += 4;
    else if (row.status === "CANC") value += 3;
    if (row.home_score != null || row.away_score != null) value += 2;
    if (row.round != null) value += 1;
    return value;
  };

  return score(b) - score(a);
}

function canonicalJsonlKey(row: JsonlRow) {
  if (row.source_event_key) return row.source_event_key;

  const teams = [norm(row.home), norm(row.away)].sort().join("|");
  const kickoff = row.kickoff_time ?? "";
  return `${row.match_date}|${kickoff}|${teams}`;
}

function dedupeJsonlRows(rows: JsonlRow[]) {
  const bestByKey = new Map<string, JsonlRow>();

  for (const row of rows) {
    const key = canonicalJsonlKey(row);
    const existing = bestByKey.get(key);
    if (!existing || compareJsonlPreference(existing, row) > 0) {
      bestByKey.set(key, row);
    }
  }

  return Array.from(bestByKey.values()).sort((a, b) => {
    if (a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date);
    if ((a.kickoff_time ?? "") !== (b.kickoff_time ?? "")) {
      return (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? "");
    }
    return `${a.home}|${a.away}`.localeCompare(`${b.home}|${b.away}`);
  });
}

function assignDerivedRounds(matches: LeagueMatchRow[]) {
  if (matches.every((match) => match.round != null)) return matches;

  const byDate = new Map<string, LeagueMatchRow[]>();
  for (const match of matches) {
    const arr = byDate.get(match.match_date) ?? [];
    arr.push(match);
    byDate.set(match.match_date, arr);
  }

  const dates = Array.from(byDate.keys()).sort();
  const hasAnyExplicitRound = matches.some((match) => match.round != null);

  if (hasAnyExplicitRound) {
    let nextRound = 1;

    for (const date of dates) {
      const rows = byDate.get(date) ?? [];
      const explicitRounds = Array.from(new Set(rows.map((row) => row.round).filter((round): round is number => round != null))).sort(
        (a, b) => a - b
      );

      if (explicitRounds.length > 0) {
        const chosenRound = explicitRounds[0];
        for (const row of rows) {
          if (row.round == null) row.round = chosenRound;
        }
        nextRound = Math.max(nextRound, chosenRound + 1);
      } else {
        for (const row of rows) row.round = nextRound;
        nextRound += 1;
      }
    }

    return matches;
  }

  const teamCount = new Set(
    matches.flatMap((match) => [match.home_team?.slug, match.away_team?.slug].filter(Boolean) as string[])
  ).size;
  const matchesPerRound = Math.max(1, Math.floor(teamCount / 2));

  let currentRound = 1;
  let currentCount = 0;
  let currentTeams = new Set<string>();

  for (const match of matches) {
    const home = match.home_team?.slug ?? "";
    const away = match.away_team?.slug ?? "";
    const clashesCurrentRound = currentTeams.has(home) || currentTeams.has(away);

    if (currentCount >= matchesPerRound || clashesCurrentRound) {
      currentRound += 1;
      currentCount = 0;
      currentTeams = new Set<string>();
    }

    match.round = currentRound;
    currentCount += 1;
    if (home) currentTeams.add(home);
    if (away) currentTeams.add(away);
  }

  return matches;
}

function compareLeagueRows(a: LeagueMatchRow, b: LeagueMatchRow) {
  const score = (row: LeagueMatchRow) => {
    let value = 0;
    if (row.status === "FT") value += 8;
    else if (row.status === "LIVE" || row.status === "HT") value += 4;
    else if (row.status === "CANC") value += 3;
    if (row.home_score != null || row.away_score != null) value += 2;
    if (row.round != null) value += 1;
    return value;
  };

  return score(b) - score(a);
}

function canonicalLeagueRowKey(row: LeagueMatchRow) {
  const teams = [norm(row.home_team?.name ?? ""), norm(row.away_team?.name ?? "")].sort().join("|");
  return `${row.match_date}|${row.kickoff_time ?? ""}|${teams}`;
}

function dedupeLeagueRows(rows: LeagueMatchRow[]) {
  const bestByKey = new Map<string, LeagueMatchRow>();

  for (const row of rows) {
    const key = canonicalLeagueRowKey(row);
    const existing = bestByKey.get(key);
    if (!existing || compareLeagueRows(existing, row) > 0) {
      bestByKey.set(key, row);
    }
  }

  return Array.from(bestByKey.values()).sort((a, b) => {
    if (a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date);
    return (a.kickoff_time || "").localeCompare(b.kickoff_time || "");
  });
}

function diffDays(a: string, b: string) {
  const timeA = new Date(`${a}T00:00:00Z`).getTime();
  const timeB = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
}

function pickSeasonWindow(rows: LeagueMatchRow[], refISO: string) {
  if (rows.length <= 1) return rows;

  const sorted = rows.slice().sort((a, b) => {
    if (a.match_date !== b.match_date) return a.match_date.localeCompare(b.match_date);
    return (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? "");
  });

  const windows: LeagueMatchRow[][] = [];
  let current: LeagueMatchRow[] = [];

  for (const row of sorted) {
    const previous = current[current.length - 1];
    if (!previous || diffDays(previous.match_date, row.match_date) <= 45) {
      current.push(row);
      continue;
    }

    windows.push(current);
    current = [row];
  }

  if (current.length) windows.push(current);
  if (windows.length === 1) return windows[0];

  const meta = windows.map((windowRows) => ({
    rows: windowRows,
    first: windowRows[0].match_date,
    last: windowRows[windowRows.length - 1].match_date,
  }));

  const containing = meta.find((windowMeta) => windowMeta.first <= refISO && refISO <= windowMeta.last);
  if (containing) return containing.rows;

  const next = meta.find((windowMeta) => windowMeta.first >= refISO);
  if (next) return next.rows;

  return meta[meta.length - 1].rows;
}

function buildMergedLeagueRows(
  compSlug: string,
  refISO: string,
  teamIds: Map<string, number>,
  getTeamRef: (name: string) => { id: number; name: string; slug: string }
) {
  const jsonl = loadJsonlRowsByCompetition();
  const jsonlRows = jsonl.get(compSlug) ?? [];
  const hasJsonlRows = jsonlRows.length > 0;
  const maxJsonlDate = hasJsonlRows
    ? jsonlRows.reduce((max, row) => (row.match_date > max ? row.match_date : max), jsonlRows[0].match_date)
    : null;
  const dumps = loadDryRunDumps();
  const dump = CURATED_ONLY_COMPETITIONS.has(compSlug) ? null : dumps.find((item) => item.competition === compSlug);

  void teamIds;

  const merged = dedupeLeagueRows([
    ...jsonlRows.map((row, index) => ({
      id: index + 1,
      match_date: row.match_date,
      kickoff_time: row.kickoff_time,
      status: row.status,
      minute: null,
      home_score: row.status === "NS" || row.status === "CANC" ? null : row.home_score,
      away_score: row.status === "NS" || row.status === "CANC" ? null : row.away_score,
      round: row.round,
      venue: null,
      home_team: getTeamRef(row.home),
      away_team: getTeamRef(row.away),
    })),
    ...dedupeRows(dump?.scrapedMatches || []).flatMap((row, index) => {
      const matchDate = inferDate(row.dateLabel || row.statusOrTime || row.rawText);
      if (!matchDate) return [];

      const hs = parseScore(row.hs);
      const as = parseScore(row.as);
      const parsed = detectStatus(row.statusOrTime, hs, as, row.sourcePage);

      if (hasJsonlRows && parsed.status !== "NS" && parsed.status !== "CANC") return [];
      if (maxJsonlDate && matchDate <= maxJsonlDate) return [];

      return [
        {
          id: 10_000 + index,
          match_date: matchDate,
          kickoff_time: inferKickoffTime(row.statusOrTime || row.rawText),
          status: parsed.status,
          minute: parsed.minute,
          home_score: parsed.status === "NS" || parsed.status === "CANC" ? null : hs,
          away_score: parsed.status === "NS" || parsed.status === "CANC" ? null : as,
          round: parseRound(row.roundText),
          venue: null,
          home_team: getTeamRef(row.home),
          away_team: getTeamRef(row.away),
        },
      ];
    }),
  ]);

  return pickSeasonWindow(merged, refISO);
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
  const rows: HomeMatchRow[] = [];
  let id = 1;
  const teamIds = new Map<string, number>();

  const getTeamRef = (name: string) => {
    const slug = slugify(name);
    if (!teamIds.has(slug)) teamIds.set(slug, teamIds.size + 1);
    return { id: teamIds.get(slug) ?? 0, name, slug };
  };

  for (const competition of COMPETITIONS) {
    const mergedLeagueRows = buildMergedLeagueRows(competition.slug, date, teamIds, getTeamRef);

    for (const row of mergedLeagueRows) {
      if (row.match_date !== date) continue;

      rows.push({
        id: id++,
        match_date: row.match_date,
        kickoff_time: row.kickoff_time,
        status: row.status,
        minute: row.minute,
        home_score: row.home_score,
        away_score: row.away_score,
        home_team: row.home_team,
        away_team: row.away_team,
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

function getFallbackLeagueMatches(compSlug: string, refISO: string): LeagueMatchRow[] {
  const teamIds = new Map<string, number>();

  const getTeamRef = (name: string) => {
    const slug = slugify(name);
    if (!teamIds.has(slug)) teamIds.set(slug, teamIds.size + 1);
    return { id: teamIds.get(slug) ?? 0, name, slug };
  };
  const rows = buildMergedLeagueRows(compSlug, refISO, teamIds, getTeamRef);

  return assignDerivedRounds(rows);
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

  return attachKnockoutPhaseMeta(
    Array.from(map.entries())
    .map(([round, value]) => ({
      round,
      first_date: value.first,
      last_date: value.last,
      matches: value.count,
      ft: value.ft,
    }))
    .sort((a, b) => a.round - b.round)
  );
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

export function getFallbackLeagueData(compSlug: string, refISO: string, roundOverride?: number | null) {
  const competition = COMPETITIONS.find((item) => item.slug === compSlug) ?? null;
  if (!competition) return null;

  const season = {
    id: competition.id,
    name: `dry-run-${new Date().getUTCFullYear()}`,
    competition_id: competition.id,
  };

  const allMatches = getFallbackLeagueMatches(compSlug, refISO);
  const roundMeta = getFallbackRoundMeta(allMatches);
  const selectedRound = roundOverride ?? pickAutoRound(roundMeta, refISO);
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
