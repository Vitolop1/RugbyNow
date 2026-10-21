import {urbaTeamSlugs} from './officialStandings';
export type UrbaFixture={sourceId:number;round:number;roundId:number;date:string;homeSlug:string;awaySlug:string;status:'NS'|'FT';homeScore:number|null;awayScore:number|null;sourceUrl:string};
type Club={id:number;name:string};
type SourceMatch={id:number;fulfilled:boolean;suspended:boolean;local_team:Club;visit_team:Club;local_team_score:number|null;visit_team_score:number|null};
type SourceTable={team_id:number;team:Club;played:number;won:number;tied:number;lost:number;points_favor:number;points_against:number};
type Source={championship:{id:number;name:string;rounds:{id:number;name:string;playdate:string;matches:SourceMatch[]}[]};standings:SourceTable[]};
export function parseUrbaCalendar(raw:unknown){
 const data=raw as Source;
 if(data?.championship?.id!==2025176||data.championship.name!=='TOP 14 - Superior'||data.championship.rounds?.length!==26||data.standings?.length!==14)throw Error('Wrong or incomplete URBA competition');
 const matches:UrbaFixture[]=[],rounds=new Set<number>(),totals=new Map<number,{pj:number;w:number;d:number;l:number;pf:number;pa:number}>();
 for(const sourceRound of data.championship.rounds){
  const label=sourceRound.name.match(/^Fecha (\d+)$/),date=sourceRound.playdate?.slice(0,10);
  const round=Number(label?.[1]);
  if(!label||round<1||round>26||rounds.has(round)||!/^2026-\d{2}-\d{2}$/.test(date)||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date||sourceRound.matches?.length!==7)throw Error('Invalid URBA round or edition');
  rounds.add(round);const clubs=new Set<string>();
  for(const m of sourceRound.matches){
   const homeSlug=urbaTeamSlugs[m.local_team?.name],awaySlug=urbaTeamSlugs[m.visit_team?.name];
   if(!Number.isSafeInteger(m.local_team?.id)||!Number.isSafeInteger(m.visit_team?.id)||m.local_team.id===m.visit_team.id||!homeSlug||!awaySlug||homeSlug===awaySlug||clubs.has(homeSlug)||clubs.has(awaySlug)||!Number.isSafeInteger(m.id))throw Error('Ambiguous URBA fixture');
   if(typeof m.fulfilled!=='boolean'||typeof m.suspended!=='boolean'||m.suspended)throw Error('URBA suspension needs explicit handling; preserve previous calendar');
   clubs.add(homeSlug);clubs.add(awaySlug);
   if(m.fulfilled){
    if([m.local_team_score,m.visit_team_score].some(s=>!Number.isSafeInteger(s)||Number(s)<0))throw Error('Final URBA result missing scores');
    for(const [team,pf,pa] of [[m.local_team.id,m.local_team_score!,m.visit_team_score!],[m.visit_team.id,m.visit_team_score!,m.local_team_score!]]){
     const t=totals.get(team)||{pj:0,w:0,d:0,l:0,pf:0,pa:0};t.pj++;t.pf+=pf;t.pa+=pa;t[pf>pa?'w':pf<pa?'l':'d']++;totals.set(team,t);
    }
   }
   matches.push({sourceId:m.id,round,roundId:sourceRound.id,date,homeSlug,awaySlug,status:m.fulfilled?'FT':'NS',homeScore:m.fulfilled?m.local_team_score:null,awayScore:m.fulfilled?m.visit_team_score:null,sourceUrl:`https://urba.org.ar/fixture?id=2025176&view=results&roundId=${sourceRound.id}`});
  }
 }
 if(matches.length!==182||new Set(matches.map(m=>m.sourceId)).size!==182||new Set(matches.map(m=>`${m.homeSlug}:${m.awaySlug}`)).size!==182)throw Error('Incomplete or repeated URBA regular calendar');
 if(data.standings.some(r=>!urbaTeamSlugs[r.team?.name]||r.team.id!==r.team_id)||new Set(data.standings.map(r=>r.team_id)).size!==14||new Set(data.standings.map(r=>urbaTeamSlugs[r.team.name])).size!==14)throw Error('Ambiguous URBA table identities');
 for(const row of data.standings){
  const actual=totals.get(row.team_id)||{pj:0,w:0,d:0,l:0,pf:0,pa:0};
  for(const [key,field] of [['pj','played'],['w','won'],['d','tied'],['l','lost'],['pf','points_favor'],['pa','points_against']] as const){
   if(actual[key]!==row[field])throw Error(`URBA results disagree with official ${field} for ${row.team.name}`);
  }
 }
 return {season:'2026',sourceName:'URBA · Top 14',sourceUrl:'https://urba.org.ar/fixture?id=2025176&view=results',checkedAt:new Date().toISOString(),fixtures:matches.sort((a,b)=>a.round-b.round||a.sourceId-b.sourceId)};
}
