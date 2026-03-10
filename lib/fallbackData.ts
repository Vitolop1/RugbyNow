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
  const match = (text || "").match(/\b(\d{1,2})\.(\d{1,2})\b/);
  if (!match) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferKickoffTime(text: string) {
  const match = (text || "").match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}:00`;
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
