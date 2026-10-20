import { getServerSupabase } from "./serverSupabase";
import { readAllRows } from "./readAllRows";
import { buildDailyEntries, shiftAgendaDate, type AgendaMatchRow, type DailyAgendaData } from "./dailyAgenda";
import { EDITORIAL_AGENDA } from "../data/rugbyAgenda";
import snapshot from "../data/supabase-snapshot.json";

export async function loadDailyAgenda(date: string): Promise<DailyAgendaData> {
  const from = shiftAgendaDate(date,-7), to = shiftAgendaDate(date,15);
  const checkedAt = new Date().toISOString();
  let rows: AgendaMatchRow[];
  let source: DailyAgendaData["source"] = "database";
  try {
    const supabase = getServerSupabase();
    rows = await readAllRows<AgendaMatchRow>((offset,size) => supabase.from("matches")
      .select("id,match_date,kickoff_time,status,minute,home_score,away_score,updated_at,source_url,home_team:home_team_id(name,slug),away_team:away_team_id(name,slug),season:season_id(competition:competition_id(name,slug,region))")
      .gte("match_date",from).lte("match_date",to).order("id").range(offset,offset+size-1)
      .abortSignal(AbortSignal.timeout(8000)) as unknown as PromiseLike<{data:AgendaMatchRow[]|null;error:{message:string}|null}>);
  } catch {
    source = "snapshot";
    const teams = new Map(snapshot.teams.map(team => [team.id,team]));
    const seasons = new Map(snapshot.seasons.map(season => [season.id,season]));
    const competitions = new Map(snapshot.competitions.map(competition => [competition.id,competition]));
    rows = snapshot.matches.filter(row => row.match_date >= from && row.match_date <= to).map(row => {
      const season = seasons.get(row.season_id);
      return {...row,home_team:teams.get(row.home_team_id!) || null,away_team:teams.get(row.away_team_id!) || null,
        season:{competition:season ? competitions.get(season.competition_id) || null : null}};
    });
  }
  return {entries:buildDailyEntries(rows,EDITORIAL_AGENDA).filter(entry => entry.date >= from && entry.date <= to),source,checkedAt,snapshotAt:snapshot.generatedAt,from,to};
}
