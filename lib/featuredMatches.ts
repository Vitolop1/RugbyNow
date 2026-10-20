import {agendaPriority,dailyEntryDate,dailyEntryState,shiftAgendaDate,type DailyEntry} from "./dailyAgenda";
/** A small, explainable selection, not a claim about ratings or match quality. */
export function selectFeaturedMatches(entries:DailyEntry[],date:string,timeZone:string,now:number,prefs:{leagues:string[];clubs:string[];hidden:string[]}){
 const eligible=entries.filter(e=>e.kind==="match"&&!prefs.hidden.includes(e.competitionSlug||"")&&e.startsAt&&["NS","LIVE","HT"].includes(dailyEntryState(e,now))&&dailyEntryDate(e,timeZone)>=date&&dailyEntryDate(e,timeZone)<=shiftAgendaDate(date,7));
 const sameDay=eligible.filter(e=>dailyEntryDate(e,timeZone)===date);
 const pool=sameDay.length?sameDay:eligible;
 const rank=(e:DailyEntry)=>(e.status==="LIVE"||e.status==="HT"?-100:0)+(prefs.clubs.includes(e.homeSlug||"")||prefs.clubs.includes(e.awaySlug||"")?-50:prefs.leagues.includes(e.competitionSlug||"")?-30:0)+agendaPriority(e)+(e.competitionSlug==="fr-pro-d2"?-0.5:0);
 return pool.slice().sort((a,b)=>rank(a)-rank(b)||(a.startsAt||"").localeCompare(b.startsAt||"")||a.id.localeCompare(b.id)).slice(0,2);
}
