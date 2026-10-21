// OpenNext generates this module during the production build.
// @ts-ignore generated worker is intentionally absent in a fresh checkout
import handler from './.open-next/worker.js';
import {LIVE_MONITOR_KEY,runLnrLiveMonitor,type MonitorBucket} from './lib/lnrLiveMonitor';
import {canonicalRequestUrl} from './lib/canonicalRequest';

type MonitorEnv={NEXT_INC_CACHE_R2_BUCKET:MonitorBucket};
export default {
 async fetch(request:Request,env:MonitorEnv,ctx:unknown){
  const canonical=canonicalRequestUrl(request.url);
  if(canonical)return Response.redirect(canonical,308);
  if(new URL(request.url).pathname==='/api/live-monitor'){
   if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
   const stored=await env.NEXT_INC_CACHE_R2_BUCKET.get(LIVE_MONITOR_KEY);
   const report=stored?await stored.json() as {finishedAt:string}:null;
   return Response.json({report,delayed:!report||Date.now()-Date.parse(report.finishedAt)>180000},{headers:{'Cache-Control':'no-store'}});
  }
  return handler.fetch(request,env,ctx);
 },
 async scheduled(event:{scheduledTime:number},env:MonitorEnv){
  console.log('LNR live monitor',JSON.stringify(await runLnrLiveMonitor(env.NEXT_INC_CACHE_R2_BUCKET,event.scheduledTime)));
 }
};
// Preserve generated Durable Object exports used by the OpenNext adapter.
// @ts-ignore generated worker
export {DOQueueHandler,DOShardedTagCache,BucketCachePurge} from './.open-next/worker.js';
