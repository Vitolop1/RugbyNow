export type HeadToHeadTeam = { id: number; name: string; slug: string | null };
export type RugbyDiscipline = "rugby-union" | "rugby-sevens" | "rugby-league";
export type HeadToHeadReference = {
  id: number;
  matchDate: string;
  kickoffTime: string | null;
  homeTeam: HeadToHeadTeam;
  awayTeam: HeadToHeadTeam;
  competitionSlug: string;
};
export type HeadToHeadCandidate = {
  id: number;
  matchDate: string;
  kickoffTime: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: HeadToHeadTeam | null;
  awayTeam: HeadToHeadTeam | null;
  competition: { name: string; slug: string } | null;
  discipline?: RugbyDiscipline;
};
export type HeadToHeadGame = {
  id: number;
  matchDate: string;
  startsAt: string | null;
  homeTeam: HeadToHeadTeam;
  awayTeam: HeadToHeadTeam;
  homeScore: number;
  awayScore: number;
  competition: { name: string; slug: string };
};
export type HeadToHeadData = {
  homeTeam: HeadToHeadTeam;
  awayTeam: HeadToHeadTeam;
  matches: HeadToHeadGame[];
  summary: { homeWins: number; draws: number; awayWins: number };
  coverage: "partial";
  source: "supabase" | "snapshot";
};

export function rugbyDiscipline(competitionSlug: string): RugbyDiscipline {
  // The current catalog is union plus separately identified SVNS competitions.
  if (competitionSlug.startsWith("svns-") || competitionSlug === "int-supersevens") return "rugby-sevens";
  if (competitionSlug.startsWith("rugby-league-")) return "rugby-league";
  return "rugby-union";
}

function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

function kickoff(day: string, time: string | null) {
  if (!time || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return null;
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const iso = `${day}T${time.length === 5 ? `${time}:00` : time}Z`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildHeadToHead(reference: HeadToHeadReference, candidates: readonly HeadToHeadCandidate[],
  source: HeadToHeadData["source"], now = Date.now()): HeadToHeadData | null {
  if (!validDay(reference.matchDate) || !Number.isFinite(now) || !Number.isInteger(reference.homeTeam.id) || reference.homeTeam.id <= 0
    || !Number.isInteger(reference.awayTeam.id) || reference.awayTeam.id <= 0
    || reference.homeTeam.id === reference.awayTeam.id) return null;
  // Without a kickoff the exact ordering within that day is unknown.
  const referenceCutoff = kickoff(reference.matchDate, reference.kickoffTime) ?? Date.parse(`${reference.matchDate}T00:00:00Z`);
  const cutoff = Math.min(referenceCutoff, now);
  const cutoffDay = new Date(cutoff).toISOString().slice(0, 10);
  const discipline = rugbyDiscipline(reference.competitionSlug);
  const seenIds = new Set<number>();
  const seenFixtures = new Set<string>();
  const available = candidates.filter(row => {
    if (!Number.isInteger(row.id) || row.id <= 0 || row.id === reference.id || row.status !== "FT" || !row.homeTeam || !row.awayTeam || !row.competition
      || !validDay(row.matchDate) || !Number.isInteger(row.homeScore) || !Number.isInteger(row.awayScore)
      || row.homeScore! < 0 || row.awayScore! < 0) return false;
    const home = row.homeTeam.id;
    const away = row.awayTeam.id;
    if (!((home === reference.homeTeam.id && away === reference.awayTeam.id)
      || (home === reference.awayTeam.id && away === reference.homeTeam.id))) return false;
    if ((row.discipline ?? rugbyDiscipline(row.competition.slug)) !== discipline) return false;
    if (row.matchDate > cutoffDay) return false;
    const starts = kickoff(row.matchDate, row.kickoffTime);
    if (row.kickoffTime && starts == null) return false;
    if (row.matchDate === cutoffDay && (starts == null || starts >= cutoff)) return false;
    return true;
  }).slice().sort((a, b) => b.matchDate.localeCompare(a.matchDate)
    || (kickoff(b.matchDate, b.kickoffTime) ?? 0) - (kickoff(a.matchDate, a.kickoffTime) ?? 0) || b.id - a.id);
  const matches: HeadToHeadGame[] = [];
  for (const row of available) {
    // Do not double count a duplicate import of the same known result.
    const key = [row.matchDate, row.kickoffTime ?? "unknown", row.homeTeam!.id, row.awayTeam!.id,
      row.homeScore, row.awayScore].join("|");
    if (seenIds.has(row.id) || seenFixtures.has(key)) continue;
    seenIds.add(row.id);
    seenFixtures.add(key);
    const starts = kickoff(row.matchDate, row.kickoffTime);
    matches.push({ id: row.id, matchDate: row.matchDate, startsAt: starts == null ? null : new Date(starts).toISOString(),
      homeTeam: row.homeTeam!, awayTeam: row.awayTeam!, homeScore: row.homeScore!, awayScore: row.awayScore!, competition: row.competition! });
    if (matches.length === 5) break;
  }
  const summary = { homeWins: 0, draws: 0, awayWins: 0 };
  for (const row of matches) {
    if (row.homeScore === row.awayScore) summary.draws++;
    else {
      const winner = row.homeScore > row.awayScore ? row.homeTeam.id : row.awayTeam.id;
      if (winner === reference.homeTeam.id) summary.homeWins++;
      else summary.awayWins++;
    }
  }
  return { homeTeam: reference.homeTeam, awayTeam: reference.awayTeam, matches, summary, coverage: "partial", source };
}
