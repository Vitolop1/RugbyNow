export type ImportHealth={source:string;competition:string;startedAt:string;finishedAt:string;ok:boolean;rows:number;updated:number;inserted:number;exitCode:number|null;dryRun:boolean;plannedUpdated:number;plannedInserted:number;failureKind?:string|null;unresolvedIdentities?:number};
export function summarizeImport(output:string,exitCode:number|null,dryRun=false,mode:"matches"|"standings"="matches"){
 const total=(pattern:RegExp)=>[...output.matchAll(pattern)].reduce((sum,m)=>sum+Number(m[1]),0);
 const rows=mode==="standings"?total(/Standings scraped:\s*(\d+)/g):total(/Scraped rows total \(deduped\):\s*(\d+)/g);
 const updated=total(/TOTAL updated matches:\s*(\d+)/g),inserted=total(/TOTAL inserted\/upserted matches:\s*(\d+)/g);
 return {ok:exitCode===0&&rows>0,rows,updated:dryRun?0:updated,inserted:dryRun?0:inserted,exitCode,dryRun,plannedUpdated:dryRun?updated:0,plannedInserted:dryRun?inserted:0,unresolvedIdentities:total(/Unresolved team identities:\s*(\d+)/g),
  failureKind:exitCode===0&&rows>0?null:/HTTP (?:403|401)/.test(output)?'access_restricted':/HTTP 429/.test(output)?'rate_limited':/HTTP 5\d{2}/.test(output)?'provider_unavailable':/timeout|timed out/i.test(output)?'timeout':rows===0?'empty_source':'process_failed'};
}

export function aggregateImportHealth(reports:ImportHealth[],expected:string[]){
 const byCompetition=new Map(reports.map(report=>[report.competition,report]));
 const missing=expected.filter(competition=>!byCompetition.has(competition));
 const failed=reports.filter(report=>!report.ok).map(report=>report.competition);
 const successful=reports.filter(report=>report.ok).length;
 return {status:!failed.length&&!missing.length&&reports.length?'success':successful?'degraded':'failed',
  successful,failed,missing,sourceRows:reports.reduce((sum,r)=>sum+r.rows,0),
  updated:reports.reduce((sum,r)=>sum+r.updated,0),inserted:reports.reduce((sum,r)=>sum+r.inserted,0),
  sources:reports,completeSourceValidation:!failed.length&&!missing.length&&reports.length>0};
}
