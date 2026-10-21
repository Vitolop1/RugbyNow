import proD2 from '../data/pro-d2-calendar.json';
import top14 from '../data/top14-calendar.json';
import {parseLnrLiveObservation} from './lnrLiveObservation';

export const LIVE_MONITOR_KEY='rugbynow-monitor/lnr-live-latest.json';
export type MonitorBucket={put(key:string,value:string,options?:unknown):Promise<unknown>;get(key:string):Promise<{json():Promise<unknown>}|null>};
export function lnrMonitorCompetitions(now:number){
 return [['fr-pro-d2',proD2],['fr-top14',top14]] .filter(([,calendar])=>(calendar as typeof proD2).fixtures.some(m=>{
   // A monitoring window is not a source status. It never marks a match LIVE.
   if(m.startsAt){const start=Date.parse(m.startsAt);return now>=start-15*60000&&now<=start+4*3600000;}
   if(m.date)return new Date(now).toISOString().slice(0,10)===m.date;
   return false;
 })).map(([slug])=>String(slug));
}
export async function runLnrLiveMonitor(bucket:MonitorBucket,scheduledAt:number,read:typeof fetch=fetch){
 const startedAt=new Date().toISOString(),sources=[];
 for(const slug of lnrMonitorCompetitions(scheduledAt)){
  const url=`https://${slug==='fr-top14'?'top14':'prod2'}.lnr.fr/calendrier-et-resultats`;
  let result:ReturnType<typeof parseLnrLiveObservation>|undefined,errorMessage:string|null=null;
  for(let attempt=0;attempt<2;attempt++)try{
   const response=await read(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error(`Source HTTP ${response.status}`);
   if(Number(response.headers.get('age')||0)>120)throw Error('Source cached longer than 120 seconds');
   result=parseLnrLiveObservation(await response.text(),slug,new Date().toISOString());break;
  }catch(error){errorMessage=error instanceof Error?error.message.slice(0,160):'Source failed';}
  if(result){await bucket.put(`rugbynow-monitor/${slug}.json`,JSON.stringify(result));sources.push({slug,status:'observed',matches:result.matches.length,active:result.matches.filter(m=>m.status==='LIVE'&&!m.postponed).length,error:null});}
  else sources.push({slug,status:'failed',matches:0,active:0,error:errorMessage});
 }
 const report={mode:'shadow',writesResults:false,scheduledAt:new Date(scheduledAt).toISOString(),startedAt,finishedAt:new Date().toISOString(),sources,status:sources.some(s=>s.status==='failed')?'failed':sources.length?'observed':'idle'};
 await bucket.put(LIVE_MONITOR_KEY,JSON.stringify(report));
 return report;
}
