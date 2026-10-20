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
