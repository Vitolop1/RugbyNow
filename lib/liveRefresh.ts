export function isLiveRefreshCandidate(row:{status?:string|null;match_date:string;kickoff_time?:string|null},now=Date.now()){
 if(row.status==="FT"||row.status==="CANC")return false;
 if(row.status==="LIVE"||row.status==="HT")return true;
 if(!row.kickoff_time)return false;
 const kickoff=Date.parse(`${row.match_date}T${row.kickoff_time.length===5?`${row.kickoff_time}:00`:row.kickoff_time}Z`);
 return Number.isFinite(kickoff)&&now-kickoff>=-15*60000&&now-kickoff<=180*60000;
}
export function isLiveDataDelayed(status:string,updatedAt?:string|null,now=Date.now()){
 if(status!=="LIVE"&&status!=="HT")return false;
 const timestamp=updatedAt?Date.parse(updatedAt):NaN;
 return !Number.isFinite(timestamp)||now-timestamp>180000;
}

// Results must also be read: finished games disappear from a live-only page.
export function liveSourceUrls(base:string){return [`${base}/live`,`${base}/results`];}
export function canRefreshLiveTarget(row:{status?:string|null;match_date:string;kickoff_time?:string|null}|null,now=Date.now()){
 return !!row&&isLiveRefreshCandidate(row,now);
}
export function assessLiveCoverage(expected:{id:number;status?:string|null;match_date?:string;kickoff_time?:string|null}[],observed:{id:number;updated_at?:string|null}[],startedAt:string){
 const since=Date.parse(startedAt),seen=new Map(observed.map(row=>[row.id,Date.parse(row.updated_at||"")]));
 // A started NS candidate can be precisely the broken live import. Requiring
 // only already-LIVE rows let every NS row get skipped with a green run.
 // This requires a fresh observation; it does not assign a sporting state.
 const required=expected.filter(row=>{
  if(row.status==="LIVE"||row.status==="HT")return true;
  if(!row.match_date||!row.kickoff_time||!isLiveRefreshCandidate({...row,match_date:row.match_date},since))return false;
  return Date.parse(`${row.match_date}T${row.kickoff_time}Z`)<=since;
 });
 const unverified=required.filter(row=>!(Number.isFinite(seen.get(row.id))&&seen.get(row.id)!>=since)).map(row=>row.id);
 return {activeExpected:required.length,activeRefreshed:required.length-unverified.length,unverifiedMatchIds:unverified};
}

// A delayed response or an older backup must not rewind the displayed score.
// Scores themselves can legitimately decrease after a source correction.
export function preferNewerReading<T>(current:T|undefined,incoming:T,timestamp:(row:T)=>string|null|undefined):T{
 if(!current)return incoming;
 const before=Date.parse(timestamp(current)||""),after=Date.parse(timestamp(incoming)||"");
 return Number.isFinite(before)&&(!Number.isFinite(after)||after<before)?current:incoming;
}
