import stored from "../data/pro-d2-calendar.json";
import snapshot from "../data/supabase-snapshot.json";
import type {ProD2Calendar,OfficialProD2Fixture} from "./proD2Calendar";
type Observation={id:number;status:string;minute:number|null;home_score:number|null;away_score:number|null;updated_at?:string|null;source_url?:string|null};
export type PendingProD2Fixture=OfficialProD2Fixture&{id:number};
export function getProD2CalendarData(observations:Observation[]=snapshot.matches){
 const calendar=stored as ProD2Calendar;
 const season=snapshot.seasons.find(s=>s.name===calendar.season&&snapshot.competitions.some(c=>c.id===s.competition_id&&c.slug==="fr-pro-d2"));
 const teams=new Map(snapshot.teams.map(t=>[t.slug,t]));
 const pending:PendingProD2Fixture[]=[];
 const matches=calendar.fixtures.flatMap(m=>{
  const home=teams.get(m.homeSlug),away=teams.get(m.awaySlug);if(!home||!away)throw Error("Official calendar team identity missing");
  const existing=snapshot.matches.find(r=>r.season_id===season?.id&&r.home_team_id===home.id&&r.away_team_id===away.id);
  const id=existing?.id??-(40000000+m.sourceId);
  if(!m.date){pending.push({...m,id});return [];}
  const observed=observations.find(r=>r.id===id)||existing;
  return [{id,match_date:m.startsAt?.slice(0,10)||m.date,kickoff_time:m.startsAt?.slice(11,19)||(observed?.status==="FT"&&existing?.match_date===m.date?existing.kickoff_time:null),status:(observed?.status||"NS") as "NS"|"LIVE"|"HT"|"FT"|"CANC",minute:observed?.minute??null,home_score:observed?.home_score??null,away_score:observed?.away_score??null,
   home_team:home,away_team:away,round:m.round,venue:existing?.venue??null,source_url:observed?.source_url||m.sourceUrl,updated_at:observed?.updated_at||calendar.checkedAt}];
 });
 return {matches,pending,meta:{sourceUrl:calendar.sourceUrl,sourceName:calendar.sourceName,checkedAt:calendar.checkedAt,season:calendar.season,total:240,category:"men-xv",phase:"regular"}};
}
