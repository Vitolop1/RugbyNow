export type ImportHealth={source:string;competition:string;startedAt:string;finishedAt:string;ok:boolean;rows:number;updated:number;inserted:number;exitCode:number|null};
export function summarizeImport(output:string,exitCode:number|null){
 const total=(pattern:RegExp)=>[...output.matchAll(pattern)].reduce((sum,m)=>sum+Number(m[1]),0);
 const rows=total(/Scraped rows total \(deduped\):\s*(\d+)/g);
 return {ok:exitCode===0&&rows>0,rows,updated:total(/TOTAL updated matches:\s*(\d+)/g),inserted:total(/TOTAL inserted\/upserted matches:\s*(\d+)/g),exitCode};
}
