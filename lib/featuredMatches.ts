import {dailyEntryDate,dailyEntryState,normalizedTeam,shiftAgendaDate,type DailyEntry} from './dailyAgenda';
type Preferences={leagues:string[];clubs:string[];hidden:string[]};
const internationals=new Set(['int-world-cup','int-six-nations','int-nations-championship','int-super-rugby-pacific','int-united-rugby-championship','eu-champions-cup']);
/** Editorial weights describe RugbyNOW's interests, never predicted match quality. */
export function selectFeaturedMatches(entries:DailyEntry[],date:string,timeZone:string,now:number,prefs:Preferences){
 const end=shiftAgendaDate(date,7);
 const localDays=new Map<DailyEntry,string>();
 const localDate=(entry:DailyEntry)=>{let day=localDays.get(entry);if(!day){day=dailyEntryDate(entry,timeZone);localDays.set(entry,day);}return day;};
 const ids=new Set<string>(),fixtures=new Set<string>();
 const eligible=entries.filter(e=>e.kind==='match')
  .sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')||a.id.localeCompare(b.id)).filter(e=>{
   const id=e.matchId!==undefined?`match-${e.matchId}`:e.id;
   const fixture=[e.competitionSlug||e.competition,normalizedTeam(e.home),normalizedTeam(e.away||''),e.startsAt].join('|');
   if(ids.has(id)||fixtures.has(fixture))return false;ids.add(id);fixtures.add(fixture);return true;
  }).filter(e=>!prefs.hidden.includes(e.competitionSlug||'')&&e.startsAt&&Number.isFinite(Date.parse(e.startsAt))&&['NS','LIVE','HT'].includes(dailyEntryState(e,now))&&localDate(e)>=date&&localDate(e)<=end);
 const sameDay=(e:DailyEntry)=>localDate(e)===date;
 const active=(e:DailyEntry)=>['LIVE','HT'].includes(dailyEntryState(e,now));
 const score=(e:DailyEntry)=>{
  const slug=e.competitionSlug||'';
  const day=localDate(e),days=(Date.parse(day)-Date.parse(date))/86400000;
  const weekday=new Date(`${day}T12:00:00Z`).getUTCDay();
  const weekend=days>0&&days<=3&&[5,6,0].includes(weekday)?8:0;
  const argentina=[e.homeSlug,e.awaySlug].some(slug=>slug==='argentina'||slug==='argentina-7s');
  const editorial=argentina?70:slug==='ar-urba-top14'?55:e.region==='argentina'?35:internationals.has(slug)?15:0;
  const followed=prefs.clubs.includes(e.homeSlug||'')||prefs.clubs.includes(e.awaySlug||'')?80:prefs.leagues.includes(slug)?55:0;
  const hours=Math.max(0,(Date.parse(e.startsAt!)-now)/3600000);
  return editorial+followed+weekend-days*25-Math.min(hours,24)*0.5;
 };
 const scores=new Map(eligible.map(entry=>[entry,score(entry)]));
 const selected:DailyEntry[]=[];
 while(eligible.length&&selected.length<2){
  // Today's fixtures always precede future ones. Explicit source LIVE/HT wins
  // within a date tier; a passed kickoff never supplies this priority.
  const value=(e:DailyEntry)=>scores.get(e)!+(selected.some(s=>s.competitionSlug===e.competitionSlug)?0:selected.length?20:0);
  eligible.sort((a,b)=>Number(sameDay(b))-Number(sameDay(a))||Number(active(b))-Number(active(a))||value(b)-value(a)||a.startsAt!.localeCompare(b.startsAt!)||a.id.localeCompare(b.id));
  selected.push(eligible.shift()!);
 }
 return selected;
}
