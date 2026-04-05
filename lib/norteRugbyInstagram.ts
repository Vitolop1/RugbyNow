export type NorteRugbyInstagramMatch = {
  round: number | null;
  home: string;
  away: string;
  home_score: number;
  away_score: number;
  status: "FT";
};

export type NorteRugbyInstagramStanding = {
  team: string;
  pts: number;
  pj?: number | null;
  w?: number | null;
  d?: number | null;
  l?: number | null;
};

export type NorteRugbyInstagramPayload = {
  generatedAt: string;
  source: string;
  profileUrl: string;
  postUrls: string[];
  matches: NorteRugbyInstagramMatch[];
  standings: NorteRugbyInstagramStanding[];
};

const TEAM_ALIASES: Record<string, string> = {
  "gimnasia y tiro": "Gimnasia y Tiro",
  "jockey club": "Jockey Club de Salta",
  "jockey club de salta": "Jockey Club de Salta",
  "old lions": "Old Lions RC",
  "old lions rc": "Old Lions RC",
  "santiago lawn tennis": "Santiago Lawn Tennis Club",
  "santiago lawn tennis club": "Santiago Lawn Tennis Club",
  "santiago rugby": "Santiago Rugby Club",
  "santiago rugby club": "Santiago Rugby Club",
  "tigres rc": "Tigres RC",
  "tigres": "Tigres RC",
  "tiro federal": "Tiro Federal de Salta",
  "tiro federal de salta": "Tiro Federal de Salta",
  universitario: "Universitario de Salta",
  "universitario de salta": "Universitario de Salta",
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeNorteGrandeTeamName(value?: string | null) {
  if (!value) return null;
  const normalized = normalizeText(value);
  return TEAM_ALIASES[normalized] ?? null;
}

function normalizeLine(line: string) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractNorteRugbyRound(text: string) {
  const normalized = normalizeLine(text);
  const match =
    normalized.match(/(?:^|\s)(\d{1,2})\s*[°º]?\s*fecha\b/i) ??
    normalized.match(/\bfecha\s*(\d{1,2})\b/i);

  if (!match) return null;

  const round = Number.parseInt(match[1], 10);
  return Number.isFinite(round) ? round : null;
}

export function looksLikeNorteGrandeCaption(text: string) {
  const normalized = normalizeText(text);
  return (
    normalized.includes("liga norte grande") ||
    normalized.includes("#lng") ||
    normalized.includes("#liganortegrande")
  );
}

export function parseNorteRugbyMatchLine(line: string) {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^(.+?)\s+(\d{1,3})\s*-\s*(\d{1,3})\s+(.+)$/);
  if (!match) return null;

  const home = normalizeNorteGrandeTeamName(match[1]);
  const away = normalizeNorteGrandeTeamName(match[4]);
  if (!home || !away || home === away) return null;

  return {
    home,
    away,
    home_score: Number.parseInt(match[2], 10),
    away_score: Number.parseInt(match[3], 10),
    status: "FT" as const,
  };
}

export function parseNorteRugbyStandingLine(line: string) {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^(.+?)\s*-\s*(\d{1,3})\s*pts?(?:\s*\(([^)]+)\))?$/i);
  if (!match) return null;

  const team = normalizeNorteGrandeTeamName(match[1]);
  if (!team) return null;

  const stats = match[3] ?? "";
  const statValue = (label: string) => {
    const statMatch = stats.match(new RegExp(`(\\d{1,2})\\s*${label}\\b`, "i"));
    if (!statMatch) return null;
    return Number.parseInt(statMatch[1], 10);
  };

  return {
    team,
    pts: Number.parseInt(match[2], 10),
    pj: statValue("PJ"),
    w: statValue("PG"),
    d: statValue("PE"),
    l: statValue("PP"),
  };
}

function dedupeMatches(matches: NorteRugbyInstagramMatch[]) {
  const byKey = new Map<string, NorteRugbyInstagramMatch>();

  for (const match of matches) {
    const key = `${match.round ?? ""}|${normalizeText(match.home)}|${normalizeText(match.away)}`;
    byKey.set(key, match);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if ((a.round ?? 0) !== (b.round ?? 0)) return (a.round ?? 0) - (b.round ?? 0);
    return `${a.home}|${a.away}`.localeCompare(`${b.home}|${b.away}`);
  });
}

function dedupeStandings(rows: NorteRugbyInstagramStanding[]) {
  const byTeam = new Map<string, NorteRugbyInstagramStanding>();

  for (const row of rows) {
    byTeam.set(normalizeText(row.team), row);
  }

  return Array.from(byTeam.values()).sort((a, b) => b.pts - a.pts || a.team.localeCompare(b.team));
}

export function extractNorteRugbyDataFromCaption(text: string) {
  const round = extractNorteRugbyRound(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const matches = dedupeMatches(
    lines
      .map((line) => parseNorteRugbyMatchLine(line))
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .map((match) => ({ ...match, round }))
  );

  const standings = dedupeStandings(
    lines
      .map((line) => parseNorteRugbyStandingLine(line))
      .filter((value): value is NonNullable<typeof value> => value !== null)
  );

  return { round, matches, standings };
}

export function isNorteRugbyInstagramPayload(value: unknown): value is NorteRugbyInstagramPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<NorteRugbyInstagramPayload>;
  return (
    typeof candidate.generatedAt === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.profileUrl === "string" &&
    Array.isArray(candidate.postUrls) &&
    Array.isArray(candidate.matches) &&
    Array.isArray(candidate.standings)
  );
}
