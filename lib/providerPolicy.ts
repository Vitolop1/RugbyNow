export type ImportHealth={source:string;competition:string;startedAt:string;finishedAt:string;ok:boolean;rows:number;updated:number;inserted:number;exitCode:number|null;dryRun:boolean;plannedUpdated:number;plannedInserted:number};
export function summarizeImport(output:string,exitCode:number|null,dryRun=false,mode:"matches"|"standings"="matches"){
 const total=(pattern:RegExp)=>[...output.matchAll(pattern)].reduce((sum,m)=>sum+Number(m[1]),0);
 const rows=mode==="standings"?total(/Standings scraped:\s*(\d+)/g):total(/Scraped rows total \(deduped\):\s*(\d+)/g);
 const updated=total(/TOTAL updated matches:\s*(\d+)/g),inserted=total(/TOTAL inserted\/upserted matches:\s*(\d+)/g);
 return {ok:exitCode===0&&rows>0,rows,updated:dryRun?0:updated,inserted:dryRun?0:inserted,exitCode,dryRun,plannedUpdated:dryRun?updated:0,plannedInserted:dryRun?inserted:0};
}
