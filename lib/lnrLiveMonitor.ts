import proD2 from '../data/pro-d2-calendar.json';
import top14 from '../data/top14-calendar.json';
import {parseLnrLiveObservation} from './lnrLiveObservation';
import {sourceRetryDelay} from './sourceRecovery';

export const LIVE_MONITOR_KEY='rugbynow-monitor/lnr-live-latest.json';
export type MonitorBucket={put(key:string,value:string,options?:unknown):Promise<unknown>;get(key:string):Promise<{json():Promise<unknown>}|null>};
type Observation=ReturnType<typeof parseLnrLiveObservation>;
export function isMonitorDelayed(report:{finishedAt?:string}|null,now=Date.now()){
 const at=Date.parse(report?.finishedAt??'');
 return !Number.isFinite(at)||at>now+5000||now-at>180000;
}
export function compareLnrObservations(previous:Observation|null,current:Observation){
 const known=new Map(previous?.matches.map(m=>[m.sourceId,m])??[]);
 return current.matches.reduce((summary,match)=>{
  const old=known.get(match.sourceId);
  if(!old){summary.newSourceIds++;return summary;}
  if(old.season!==match.season||old.competitionSlug!==match.competitionSlug||old.homeSlug!==match.homeSlug||old.awaySlug!==match.awaySlug)throw Error('Source ID identity changed; previous observation preserved');
  if(old.status==='FT'&&match.status!=='FT')throw Error('Source final regressed; previous observation preserved');
  if(old.status!==match.status||old.homeScore!==match.homeScore||old.awayScore!==match.awayScore||old.postponed!==match.postponed)summary.changedMatches++;
  return summary;
 },{newSourceIds:0,changedMatches:0});
}
export function lnrMonitorCompetitions(now:number){
 return [['fr-pro-d2',proD2],['fr-top14',top14]] .filter(([,calendar])=>(calendar as typeof proD2).fixtures.some(m=>{
   // A monitoring window is not a source status. It never marks a match LIVE.
   if(m.startsAt){const start=Date.parse(m.startsAt);return now>=start-15*60000&&now<=start+4*3600000;}
   if(m.date)return new Date(now).toISOString().slice(0,10)===m.date;
   return false;
 })).map(([slug])=>String(slug));
}
export async function runLnrLiveMonitor(bucket:MonitorBucket,scheduledAt:number,read:typeof fetch=fetch,pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 const startedAt=new Date().toISOString(),sources=[];
 for(const slug of lnrMonitorCompetitions(scheduledAt)){
  const url=`https://${slug==='fr-top14'?'top14':'prod2'}.lnr.fr/calendrier-et-resultats`;
  const key=`rugbynow-monitor/${slug}.json`;
  const stored=await bucket.get(key);
  const previous=stored?await stored.json() as Observation:null;
  let result:ReturnType<typeof parseLnrLiveObservation>|undefined,errorMessage:string|null=null;
  let attempts=0,httpStatus:number|null=null,sourceCacheAgeSeconds:number|null=null;
  const requestStarted=Date.now();
  for(let attempt=1;attempt<=2;attempt++){
   let retryAfter:string|null=null;
   attempts=attempt;httpStatus=null;
   try{
   const response=await read(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
   httpStatus=response.status;retryAfter=response.headers.get('retry-after');
   if(!response.ok)throw Error(`Source HTTP ${response.status}`);
   sourceCacheAgeSeconds=response.headers.has('age')?Number(response.headers.get('age')):null;
   if(sourceCacheAgeSeconds!==null&&(!Number.isFinite(sourceCacheAgeSeconds)||sourceCacheAgeSeconds<0||sourceCacheAgeSeconds>120))throw Error('Invalid or stale source cache age');
   result=parseLnrLiveObservation(await response.text(),slug,new Date().toISOString());break;
   }catch(error){
    errorMessage=error instanceof Error?error.message.slice(0,160):'Source failed';
    const delay=sourceRetryDelay(httpStatus??0,attempt,retryAfter);
    if(delay===null)break;
    await pause(delay);
   }
  }
  const health={slug,attempts,httpStatus,sourceCacheAgeSeconds,collectionDurationMs:Date.now()-requestStarted,
   previousObservedAt:previous?.observedAt??null,sourceUpdatedAt:null,unmappedMatches:result?.matches.length??0};
  if(result){
   try{
    const changes=compareLnrObservations(previous,result);
    if(previous&&Date.parse(previous.observedAt)>Date.parse(result.observedAt))throw Error('Older observation rejected');
    await bucket.put(key,JSON.stringify(result));
    sources.push({...health,status:'observed',matches:result.matches.length,active:result.matches.filter(m=>m.status==='LIVE'&&!m.postponed).length,error:null,
     observedAt:result.observedAt,lastValidObservedAt:result.observedAt,retainedPrevious:false,...changes});
   }catch(error){sources.push({...health,status:'failed',matches:0,active:0,error:error instanceof Error?error.message:'Observation storage failed',observedAt:null,lastValidObservedAt:previous?.observedAt??null,retainedPrevious:!!previous});}
  }else sources.push({...health,status:'failed',matches:0,active:0,error:errorMessage,observedAt:null,lastValidObservedAt:previous?.observedAt??null,retainedPrevious:!!previous});
 }
 const failed=sources.filter(s=>s.status==='failed').length;
 const report={mode:'shadow',writesResults:false,scheduledAt:new Date(scheduledAt).toISOString(),startedAt,finishedAt:new Date().toISOString(),sources,
  databaseWrites:0,sourceToDatabaseLatencyMs:null,status:failed?(failed===sources.length?'failed':'degraded'):sources.length?'observed':'idle'};
 await bucket.put(LIVE_MONITOR_KEY,JSON.stringify(report));
 return report;
}
