import official from "@/data/official-standings.json";
import snapshot from "@/data/supabase-snapshot.json";
import type {OfficialTable} from "./officialStandings";
const officialTeamIds=new Map(snapshot.teams.map(team=>[team.slug,team.id]));
type StandingPayload={competition?:{slug:string};season?:{name:string}|null;standings?:unknown[];standingsSource?:string;matches?:unknown[];match?:{home_team?:{slug?:string|null}|null;away_team?:{slug?:string|null}|null}};
export function withOfficialStandings<T extends StandingPayload>(payload:T){
 const table=(official.tables as OfficialTable[]).find(t=>t.competitionSlug===payload.competition?.slug&&t.season===payload.season?.name);
 if(!table){
  // FT scores do not identify bonus, sanctions, tie-breaks or the group/phase.
  if(payload.standingsSource==="computed"||payload.season?.name.startsWith("dry-run"))return {...payload,standings:[],standingsSource:"unavailable",...("homeStanding" in payload?{homeStanding:null,awayStanding:null}:{}),standingsNotice:"No verified classification for this edition and phase."};
  return payload;
 }
 const existing=payload.standings as Array<{teamSlug?:string;teamId?:number;form?:unknown[]}>|undefined;
 if(table.rows.some(row=>!officialTeamIds.has(row.slug)))return {...payload,standings:[],standingsSource:"unavailable",standingsNotice:"Official club identity is unresolved."};
 const standings=table.rows.map(row=>{const previous=existing?.find(r=>r.teamSlug===row.slug);return {...row,teamId:officialTeamIds.get(row.slug)!,teamSlug:row.slug,form:previous?.form||[]};});
 return {...payload,standings,...("homeStanding" in payload?{homeStanding:standings.find(r=>r.teamSlug===payload.match?.home_team?.slug)||null,awayStanding:standings.find(r=>r.teamSlug===payload.match?.away_team?.slug)||null}:{}),standingsSource:"official",standingsMeta:{sourceUrl:table.sourceUrl,sourceName:table.sourceName||"URBA",checkedAt:table.checkedAt,roundDate:table.roundDate,phase:table.phase||"regular"}};
}
