import {getUrbaCalendarData,isUrbaRegularDate} from "./urbaCalendarData";
import {getLnrCalendarData} from "./proD2CalendarData";
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
      .select("id,match_date,kickoff_time,status,minute,home_score,away_score,updated_at,source_url,home_team:home_team_id(name,slug),away_team:away_team_id(name,slug),season:season_id(name,competition:competition_id(name,slug,region))")
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
        season:{name:season?.name,competition:season ? competitions.get(season.competition_id) || null : null}};
    });
  }
  {
    for(const [slug,name] of [["fr-pro-d2","Pro D2"],["fr-top14","Top 14"]]){
    const calendar=getLnrCalendarData(slug,rows)!;
    const {regularFrom,regularTo}=calendar.meta;
    if(to<regularFrom||from>regularTo)continue;
    rows=rows.filter(r=>r.season?.competition?.slug!==slug||r.match_date<regularFrom||r.match_date>regularTo);
    rows.push(...calendar.matches.filter(r=>r.match_date>=from&&r.match_date<=to).map(r=>({...r,season:{name:calendar.meta.season,competition:{name,slug,region:"France"}}})));
  }
  }
  if(to>="2026-03-14"&&from<="2026-10-17"){
    rows=rows.filter(r=>r.season?.competition?.slug!=="ar-urba-top14"||!isUrbaRegularDate(r.match_date));
    rows.push(...getUrbaCalendarData().matches.filter(r=>r.match_date>=from&&r.match_date<=to).map(r=>({...r,season:{name:"2026",competition:{name:"URBA Top 14",slug:"ar-urba-top14",region:"Argentina"}}})));
  }
  if(to>="2027-10-01"&&from<="2027-11-13"){
    const official=worldCup2027Matches(rows.map(r=>({id:r.id,status:r.status,minute:r.minute,home_score:r.home_score,away_score:r.away_score,updated_at:r.updated_at,source_url:r.source_url})));
    rows=rows.filter(r=>r.season?.competition?.slug!=="int-world-cup"||r.match_date<"2027-10-01"||r.match_date>"2027-11-13");
    rows.push(...official.filter(r=>r.match_date>=from&&r.match_date<=to).map(r=>({...r,season:{name:"2027",competition:{name:"Rugby World Cup 2027 · Men",slug:"int-world-cup",region:"International"}}})));
  }
  return {entries:buildDailyEntries(rows,EDITORIAL_AGENDA).filter(entry => entry.date >= from && entry.date <= to),source,checkedAt,snapshotAt:snapshot.generatedAt,from,to};
}
