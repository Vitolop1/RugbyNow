import schedule from "../data/world-cup-2027.json";
import snapshot from "../data/supabase-snapshot.json";

export const WORLD_CUP_2027_META={season:schedule.season,category:schedule.category,sourceName:schedule.sourceName,sourceUrl:schedule.sourceUrl,checkedAt:schedule.checkedAt,total:52};
/** Negative IDs namespace official conditional fixtures, never database clubs. */
type ScoreObservation={id:number;status:string;minute:number|null;home_score:number|null;away_score:number|null;updated_at?:string|null;source_url?:string|null};
export function worldCup2027Matches(observations:ScoreObservation[]=snapshot.matches){
 const season=snapshot.seasons.find(s=>s.name==="2027"&&snapshot.competitions.some(c=>c.id===s.competition_id&&c.slug===schedule.competitionSlug));
 const teams=new Map(snapshot.teams.map(t=>[t.slug,t]));
 return schedule.matches.map(m=>{
  const home=m.homeSlug?teams.get(m.homeSlug):null,away=m.awaySlug?teams.get(m.awaySlug):null;
  const existing=home&&away?snapshot.matches.find(r=>r.season_id===season?.id&&r.home_team_id===home.id&&r.away_team_id===away.id):null;
  const observed=existing?observations.find(row=>row.id===existing.id):null;
  return {id:existing?.id??-(20270000+m.number),match_date:m.startsAt.slice(0,10),kickoff_time:m.startsAt.slice(11,19),status:(observed?.status||"NS") as "NS"|"LIVE"|"HT"|"FT"|"CANC",minute:observed?.minute??null,home_score:observed?.home_score??null,away_score:observed?.away_score??null,
   home_team:home??{id:0,name:m.home,slug:null},away_team:away??{id:0,name:m.away,slug:null},
   round:m.pool?Math.ceil(m.number/12):m.number<=44?4:m.number<=48?5:m.number<=50?6:7,
   venue:`${m.venue}, ${m.city}`,source_url:observed?.source_url||schedule.sourceUrl,updated_at:observed?.updated_at||schedule.checkedAt,conditional:m.conditional,pool:m.pool,
   sourceLabel:schedule.sourceName,officialNumber:m.number};
 });
}
export function officialWorldCupFixture(id:number){return worldCup2027Matches().find(m=>m.id===id)||null;}
