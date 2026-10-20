// Server/CLI only. Keys never enter a browser bundle or a public response.
export type RugbyApiGame={id:number;date:string;time?:string;timestamp?:number;status:{short:string};league:{id:number;name:string;season:number};teams:{home:{id:number;name:string};away:{id:number;name:string}};scores:{home:number|null;away:number|null}};
export type NormalizedApiGame={sourceId:string;startsAt:string;leagueId:number;season:number;homeId:number;awayId:number;home:string;away:string;status:"NS"|"LIVE"|"HT"|"FT"|"CANC";homeScore:number|null;awayScore:number|null};
export function normalizeApiGame(game:RugbyApiGame):NormalizedApiGame{
 const start=new Date(game.date);
 if(!Number.isInteger(game.id)||!Number.isInteger(game.league?.id)||!Number.isInteger(game.league?.season)||!game.teams?.home?.name||!game.teams?.away?.name||!Number.isInteger(game.teams.home.id)||!Number.isInteger(game.teams.away.id)||!/(Z|[+-]\d{2}:\d{2})$/.test(game.date)||!Number.isFinite(start.getTime()))throw Error("Invalid provider event identity or timezone");
 const statuses:Record<string,NormalizedApiGame["status"]>={NS:"NS","1H":"LIVE","2H":"LIVE",ET:"LIVE",HT:"HT",FT:"FT",AET:"FT",CANC:"CANC"};
 const status=statuses[game.status.short];if(!status)throw Error(`Unsupported source status: ${game.status.short}`);
 for(const score of [game.scores.home,game.scores.away])if(score!==null&&(!Number.isInteger(score)||score<0))throw Error("Invalid score");
 return {sourceId:`api-sports:${game.id}`,startsAt:start.toISOString(),leagueId:game.league.id,season:game.league.season,homeId:game.teams.home.id,awayId:game.teams.away.id,home:game.teams.home.name,away:game.teams.away.name,status,homeScore:game.scores.home,awayScore:game.scores.away};
}
export async function readRugbyApi<T>(endpoint:"leagues"|"games",parameters:Record<string,string>,key:string):Promise<T[]>{
 if(!key?.trim())throw Error("API_SPORTS_KEY is required");
 const url=new URL(`https://v1.rugby.api-sports.io/${endpoint}`);for(const [k,v] of Object.entries(parameters))url.searchParams.set(k,v);
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(url,{headers:{"x-apisports-key":key},signal:AbortSignal.timeout(12000),redirect:"error"});
  if((response.status===429||response.status>=500)&&attempt<2){const delay=Math.min(5000,Math.max(1000,Number(response.headers.get("retry-after"))*1000||1000*(attempt+1)));await new Promise(resolve=>setTimeout(resolve,delay));continue;}
  if(!response.ok)throw Error(`Rugby API returned HTTP ${response.status}`);
  const payload=await response.json() as {errors?:unknown;response?:T[];paging?:{current:number;total:number}};
  if(payload.errors&&Object.keys(payload.errors as object).length)throw Error("Rugby API reported authentication, quota or parameter errors");
  if(!Array.isArray(payload.response))throw Error("Rugby API response is invalid");
  if(payload.paging&&payload.paging.total>1)throw Error("Paginated API response requires explicit pagination before publication");
  return payload.response;
 }
 throw Error("Rugby API unavailable");
}
