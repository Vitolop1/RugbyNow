import {getProD2Team} from './proD2';
import {top14Teams} from './officialStandings';

export function parseLnrLiveObservation(html:string,competitionSlug:string,observedAt:string,expectedSeason='2026/2027'){
 const top14=competitionSlug==='fr-top14';
 if(!top14&&competitionSlug!=='fr-pro-d2')throw Error('Unsupported LNR competition');
 const domain=top14?'top14.lnr.fr':'prod2.lnr.fr';
 const raw=html.match(/:matches='([^']+)'/)?.[1];
 if(!raw)throw Error('Official scoreboard missing');
 const rows:unknown=JSON.parse(raw.replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&amp;/g,'&'));
 if(!Array.isArray(rows)||rows.length!==(top14?7:8))throw Error('Incomplete official scoreboard');
 const slugs=new Set<string>(),ids=new Set<number>(),rounds=new Set<string>(),editions=new Set<string>();
 const matches=rows.map(row=>{
   const source=new URL(row.link);
   const fixture=source.pathname.match(/^\/feuille-de-match\/(20\d{2}-20\d{2})\/(j\d+)\/(\d+)-/);
   if(source.origin!==`https://${domain}`||!fixture||fixture[1].replace('-','/')!==expectedSeason||Number(fixture[3])!==row.id||!Number.isSafeInteger(row.id)||ids.has(row.id))throw Error('Ambiguous official fixture or wrong edition');
   const club=(name:string)=>top14?top14Teams[name]:getProD2Team(name)?.slug;
   const homeSlug=club(row.hosting_club?.name),awaySlug=club(row.visiting_club?.name);
   if(!homeSlug||!awaySlug||homeSlug===awaySlug||slugs.has(homeSlug)||slugs.has(awaySlug))throw Error('Unknown or repeated club');
   slugs.add(homeSlug);slugs.add(awaySlug);ids.add(row.id);rounds.add(fixture[2]);editions.add(fixture[1]);
   // These are explicit LNR payload states, also enumerated by the public LNR client.
   // Never use its browser timer: it advances by wall clock, not an observed minute.
   if(!['not-started','live','finished'].includes(row.status))throw Error('Unknown source state; preserve previous observation');
   if(!Array.isArray(row.score)||row.score.length!==2||row.score.some((s:unknown)=>!Number.isSafeInteger(s)||Number(s)<0))throw Error('Invalid official score');
   const status=row.status==='finished'?'FT':row.status==='live'?'LIVE':'NS';
   return {sourceId:row.id,competitionSlug,season:fixture[1].replace('-','/'),homeSlug,awaySlug,status,
     postponed:row.is_postponed===true,minute:null,homeScore:status==='NS'?null:row.score[0],awayScore:status==='NS'?null:row.score[1],sourceUrl:source.href,observedAt};
 });
 if(rounds.size!==1||editions.size!==1)throw Error('Mixed official round or season');
 return {competitionSlug,sourceUrl:`https://${domain}/calendrier-et-resultats`,observedAt,matches};
}
