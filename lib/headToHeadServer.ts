import type { SupabaseClient } from "@supabase/supabase-js";
import snapshot from "../data/supabase-snapshot.json";
import { buildHeadToHead, type HeadToHeadCandidate, type HeadToHeadReference, type HeadToHeadTeam } from "./headToHead";
import { readAllRows } from "./readAllRows";

type DatabaseHistory = {
  id: number; match_date: string; kickoff_time: string | null; status: string; home_score: number | null; away_score: number | null;
  home_team: HeadToHeadTeam | HeadToHeadTeam[] | null; away_team: HeadToHeadTeam | HeadToHeadTeam[] | null;
  season: { competition: { name: string; slug: string } | null } | { competition: { name: string; slug: string } | null }[] | null;
};

const unwrap = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value;

export function getSnapshotHeadToHead(reference: HeadToHeadReference) {
  const teams = new Map<number, HeadToHeadTeam>(snapshot.teams.map(team => [team.id, team]));
  // Curated fallbacks use their own numeric IDs; never cross those namespaces.
  const sameTeam = (team: HeadToHeadTeam) => {
    const stored = teams.get(team.id);
    return stored && (team.slug && stored.slug ? team.slug === stored.slug : team.name === stored.name);
  };
  if (!sameTeam(reference.homeTeam) || !sameTeam(reference.awayTeam)) return null;
  const seasons = new Map(snapshot.seasons.map(season => [season.id, season]));
  const competitions = new Map(snapshot.competitions.map(competition => [competition.id, competition]));
  const candidates: HeadToHeadCandidate[] = snapshot.matches.map(row => {
    const season = seasons.get(row.season_id);
    const competition = season ? competitions.get(season.competition_id) : null;
    return { id: row.id, matchDate: row.match_date, kickoffTime: row.kickoff_time, status: row.status,
      homeScore: row.home_score, awayScore: row.away_score, homeTeam: teams.get(row.home_team_id ?? 0) ?? null,
      awayTeam: teams.get(row.away_team_id ?? 0) ?? null, competition: competition ? { name: competition.name, slug: competition.slug } : null };
  });
  return buildHeadToHead(reference, candidates, "snapshot");
}

export async function getDatabaseHeadToHead(client: SupabaseClient, reference: HeadToHeadReference) {
  try {
    const home = reference.homeTeam.id;
    const away = reference.awayTeam.id;
    const rows = await readAllRows<DatabaseHistory>((offset, size) => client.from("matches")
      .select(`id,match_date,kickoff_time,status,home_score,away_score,
        home_team:home_team_id(id,name,slug),away_team:away_team_id(id,name,slug),
        season:season_id(competition:competition_id(name,slug))`)
      .or(`and(home_team_id.eq.${home},away_team_id.eq.${away}),and(home_team_id.eq.${away},away_team_id.eq.${home})`)
      .eq("status", "FT").not("home_score", "is", null).not("away_score", "is", null)
      .neq("id", reference.id).lte("match_date", reference.matchDate)
      .order("id", { ascending: true }).range(offset, offset + size - 1) as unknown as PromiseLike<{ data: DatabaseHistory[] | null; error: { message: string } | null }>);
    const candidates: HeadToHeadCandidate[] = rows.map(row => ({ id: row.id, matchDate: row.match_date,
      kickoffTime: row.kickoff_time, status: row.status, homeScore: row.home_score, awayScore: row.away_score,
      homeTeam: unwrap(row.home_team), awayTeam: unwrap(row.away_team), competition: unwrap(row.season)?.competition ?? null }));
    return buildHeadToHead(reference, candidates, "supabase");
  } catch {
    return getSnapshotHeadToHead(reference);
  }
}
