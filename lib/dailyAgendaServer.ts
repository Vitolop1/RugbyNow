import {getProD2CalendarData} from "./proD2CalendarData";
import {worldCup2027Matches} from "./worldCup2027";
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
  if(to>="2026-08-01"&&from<="2027-06-01"){
    const calendar=getProD2CalendarData(rows);
    rows=rows.filter(r=>r.season?.competition?.slug!=="fr-pro-d2"||r.match_date<"2026-08-01"||r.match_date>"2027-06-01");
    rows.push(...calendar.matches.filter(r=>r.match_date>=from&&r.match_date<=to).map(r=>({...r,season:{competition:{name:"Pro D2",slug:"fr-pro-d2",region:"France"}}})));
  }
  if(to>="2027-10-01"&&from<="2027-11-13"){
    const official=worldCup2027Matches(rows.map(r=>({id:r.id,status:r.status,minute:r.minute,home_score:r.home_score,away_score:r.away_score,updated_at:r.updated_at,source_url:r.source_url})));
    rows=rows.filter(r=>r.season?.competition?.slug!=="int-world-cup"||r.match_date<"2027-10-01"||r.match_date>"2027-11-13");
    rows.push(...official.filter(r=>r.match_date>=from&&r.match_date<=to).map(r=>({...r,season:{competition:{name:"Rugby World Cup 2027 · Men",slug:"int-world-cup",region:"International"}}})));
  }
  return {entries:buildDailyEntries(rows,EDITORIAL_AGENDA).filter(entry => entry.date >= from && entry.date <= to),source,checkedAt,snapshotAt:snapshot.generatedAt,from,to};
}
