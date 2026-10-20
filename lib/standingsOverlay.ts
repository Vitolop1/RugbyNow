import official from "@/data/official-standings.json";
import type {OfficialTable} from "./officialStandings";
type StandingPayload={competition?:{slug:string};season?:{name:string}|null;standings?:unknown[];standingsSource?:string;matches?:unknown[]};
export function withOfficialStandings<T extends StandingPayload>(payload:T){
 const table=(official.tables as OfficialTable[]).find(t=>t.competitionSlug===payload.competition?.slug&&t.season===payload.season?.name);
 if(!table)return payload;
 const existing=payload.standings as Array<{teamSlug?:string;teamId?:number;form?:unknown[]}>|undefined;
 return {...payload,standings:table.rows.map(row=>{const previous=existing?.find(r=>r.teamSlug===row.slug);return {...row,teamId:previous?.teamId??-row.position,teamSlug:row.slug,form:previous?.form||[]};}),standingsSource:"official",standingsMeta:{sourceUrl:table.sourceUrl,checkedAt:table.checkedAt,roundDate:table.roundDate}};
}
