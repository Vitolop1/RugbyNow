import {getUrbaCalendarData,isUrbaRegularDate} from "./urbaCalendarData";
import type {OfficialTable} from "./officialStandings";
import {getLnrCalendarData} from "./proD2CalendarData";
import snapshot from "../data/supabase-snapshot.json";
import official from "../data/official-standings.json";
import squads from "../data/team-squads.json";
import {worldCup2027Matches,WORLD_CUP_2027_META} from "./worldCup2027";
import {usableCachedStandings} from "./sourceStandings";
export function getCoverageInventory(){
 const teams=new Map(snapshot.teams.map(t=>[t.id,t]));
 return snapshot.competitions.flatMap(c=>snapshot.seasons.filter(s=>s.competition_id===c.id&&!s.name.startsWith("dry-run")&&s.name!=="Current").flatMap(season=>{
  const matches=snapshot.matches.filter(m=>m.season_id===season.id);const cache=snapshot.standings_cache.filter(r=>r.season_id===season.id);
  const table=(official.tables as OfficialTable[]).find(t=>t.competitionSlug===c.slug&&t.season===season.name);
  const proD2=season.name==="2026/2027"?getLnrCalendarData(c.slug):null;
  const urba=c.slug==="ar-urba-top14"&&season.name==="2026"?getUrbaCalendarData():null;
  const world=c.slug==="int-world-cup"&&season.name==="2027";
  if(!matches.length&&!cache.length&&!world)return [];
  const teamIds=new Set(matches.flatMap(m=>[m.home_team_id,m.away_team_id]).filter((id):id is number=>id!==null));
  const directories=squads.squads.filter(s=>(s.kind==="club-directory"||s.season===season.name)&&[...teamIds].some(id=>teams.get(id)?.slug===s.teamSlug));
  const dates=matches.map(m=>m.updated_at).filter((d):d is string=>!!d).sort();
  return [{slug:c.slug,name:c.name,season:season.name,matches:urba?182+matches.filter(m=>!isUrbaRegularDate(m.match_date)).length:proD2?proD2.meta.total:world?worldCup2027Matches().length:matches.length,results:urba?urba.matches.filter(m=>m.status==="FT").length:matches.filter(m=>m.status==="FT"&&m.home_score!==null&&m.away_score!==null).length,
   calendar:urba||proD2?"official-regular-complete":world?"official-complete":"partial",unconfirmed:proD2?.pending.length||0,teams:teamIds.size,table:table?"official":usableCachedStandings(cache,teams,c.slug,season.name)?"source":"unavailable",tableTeams:table?.rows.length||(usableCachedStandings(cache,teams,c.slug,season.name)?cache.length:0),
   phase:table?(table.phase||"regular"):"unverified",directories:directories.length,seasonSquads:directories.filter(s=>s.kind==="season-squad"&&s.season===season.name).length,players:directories.reduce((sum,s)=>sum+s.players.length,0),live:"not-verified",sourceUrl:urba?urba.meta.sourceUrl:proD2?proD2.meta.sourceUrl:world?WORLD_CUP_2027_META.sourceUrl:matches.find(m=>m.source_url)?.source_url||null,tableSource:table?.sourceUrl||null,updatedAt:urba?urba.meta.checkedAt:proD2?proD2.meta.checkedAt:world?WORLD_CUP_2027_META.checkedAt:dates.at(-1)||null}];
 })).sort((a,b)=>a.name.localeCompare(b.name)||b.season.localeCompare(a.season));
}
export type CoverageRow=ReturnType<typeof getCoverageInventory>[number];
