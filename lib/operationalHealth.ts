import type {TeamSquad} from "./squads";
export type HealthArea = "Backend" | "Datos deportivos" | "SEO" | "Analytics" | "Monetización" | "Automatizaciones";
export const seasonMembershipCount=(squads:TeamSquad[])=>squads.filter(s=>s.season&&s.kind==="season-squad").reduce((n,s)=>n+s.players.length,0);
export type HealthMetric = {
  area: HealthArea; name: string; value: number | string | null; unit: string;
  period: string; source: string; observedAt: string;
  verification: "observed" | "unavailable"; note?: string;
};
export type ProbeTarget = {path: string; expected: number; kind: "agenda" | "league" | "match" | "team" | "catalog" | "preferences" | "monitor" | "text" | "sitemap" | "robots" | "ads"};
export type Probe = {path: string; at: string; status: number | null; expected: number; ms: number; bytes: number;
  ok: boolean; issue?: string; source?: string; cache?: string; serverDate?: string;
  checkedAt?: string; snapshotAt?: string; documentEntries?: number; monitorStatus?: string; schedulerAt?: string};
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function distribution(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a,b)=>a-b);
  const percentile = (p:number) => sorted.length ? sorted[Math.ceil(sorted.length*p)-1] : null;
  return {n:sorted.length,mean:sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null,p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1)??null};
}
export function parseMatchId(value: unknown): number | null {
  if(typeof value!=="string" || !/^-?[1-9]\d*$/.test(value)) return null;
  const id=Number(value);return Number.isSafeInteger(id)?id:null;
}
export function sourceAgeSeconds(timestamp: unknown, reference: string): number | null {
  if(typeof timestamp!=="string")return null;
  const age=(Date.parse(reference)-Date.parse(timestamp))/1000;
  // Clock skew is unknown freshness, never silently relabel it as age zero.
  return Number.isFinite(age)&&age>=0?age:null;
}
function validPayload(kind: ProbeTarget["kind"], body: string, json: Record<string,unknown>) {
  switch(kind){
    case "agenda":return Array.isArray(json.entries)&&["database","snapshot"].includes(String(json.source));
    case "league":return !!json.competition&&Array.isArray(json.matches)&&Array.isArray(json.standings);
    case "match":return !!record(json.match).id||!!json.pendingFixture;
    case "team":return !!record(json.team).slug;
    case "catalog":return Array.isArray(json.competitions)&&json.competitions.length>0;
    case "preferences":return Array.isArray(json.leagues)&&Array.isArray(json.clubs);
    case "monitor":return !!json.report; // HTTP 200/null is not a functioning monitor.
    case "sitemap":return /<(urlset|sitemapindex)[\s>]/.test(body)&&body.includes("<loc>");
    case "robots":return /^User-agent:/mi.test(body)&&!/<html/i.test(body);
    case "ads":return /^google\.com,\s*pub-\d+,\s*(DIRECT|RESELLER),/mi.test(body);
    case "text":return body.trim().length>0;
  }
}
/** A bounded GET probe. No credentials, body dumps, exception text or automatic retries. */
export async function probeEndpoint(base: string,target: ProbeTarget,fetcher: typeof fetch=fetch): Promise<Probe> {
  const at=new Date().toISOString(),begin=performance.now();
  const result:Probe={path:target.path,at,status:null,expected:target.expected,ms:0,bytes:0,ok:false};
  try{
    const response=await fetcher(new URL(target.path,base),{signal:AbortSignal.timeout(12000),redirect:"error"});
    result.status=response.status;result.cache=response.headers.get("cache-control")??undefined;
    result.serverDate=response.headers.get("date")??undefined;
    const reader=response.body?.getReader();const chunks:Uint8Array[]=[];
    if(reader)for(;;){const {done,value}=await reader.read();if(done)break;result.bytes+=value.byteLength;
      if(result.bytes>2_000_000){await reader.cancel();throw new Error("payload_limit");}chunks.push(value);}
    const body=new TextDecoder().decode(Buffer.concat(chunks));let json:Record<string,unknown>={};
    if(!["text","sitemap","robots","ads"].includes(target.kind))try{json=record(JSON.parse(body));}catch{result.issue="invalid_json";}
    result.ok=!result.issue&&response.status===target.expected&&(target.expected!==200||validPayload(target.kind,body,json));
    if(!result.ok)result.issue??=response.status===target.expected?"invalid_or_empty_payload":"unexpected_http_status";
    if(target.kind==="sitemap"&&result.ok)result.documentEntries=(body.match(/<loc>/g)??[]).length;
    for(const field of ["source","checkedAt","snapshotAt"] as const)if(typeof json[field]==="string")result[field]=json[field];
    if(target.kind==="monitor"){
      const monitor=record(json.report);result.monitorStatus=String(monitor.status??"missing");
      if(typeof monitor.scheduledAt==="string")result.schedulerAt=monitor.scheduledAt;
      if(json.delayed===true){result.ok=false;result.issue="scheduler_delayed";}
      // Idle verifies a heartbeat only; it supplies no source-latency measurement.
    }
  }catch(error){result.issue=error instanceof Error&&error.message==="payload_limit"?"payload_limit":
    error instanceof Error&&["TimeoutError","AbortError"].includes(error.name)?"timeout":"request_failed";}
  result.ms=Math.round(performance.now()-begin);return result;
}
export type WorkflowRun={id:number;name:string;event:string;status:string;conclusion:string|null;created_at:string;run_started_at:string;updated_at:string;head_branch:string};
export function summarizeRuns(runs:WorkflowRun[]){
  const groups=new Map<string,WorkflowRun[]>();
  for(const run of runs.filter(r=>r.event==="schedule"&&r.head_branch==="main"))groups.set(run.name,[...(groups.get(run.name)??[]),run]);
  return [...groups].map(([name,items])=>{
    const ordered=items.slice().sort((a,b)=>a.created_at.localeCompare(b.created_at));
    return {name,runs:items.length,completed:items.filter(r=>r.status==="completed").length,
      failed:items.filter(r=>r.conclusion==="failure").length,cancelled:items.filter(r=>r.conclusion==="cancelled").length,
      latestCreatedAt:ordered.at(-1)!.created_at,latestSuccessfulAt:ordered.filter(r=>r.conclusion==="success").at(-1)?.updated_at??null,
      observedGapsMinutes:distribution(ordered.slice(1).map((r,i)=>(Date.parse(r.created_at)-Date.parse(ordered[i].created_at))/60000)),
      durationSeconds:distribution(items.filter(r=>r.status==="completed").map(r=>(Date.parse(r.updated_at)-Date.parse(r.run_started_at))/1000))};
  });
}
export function healthFindings(probes:Probe[],snapshotAt:string,runs:ReturnType<typeof summarizeRuns>,activeNames:string[],now:string){
  const findings=probes.filter(p=>!p.ok).map(p=>({code:p.issue??"probe_failed",source:p.path,note:"Response failed the expected HTTP/payload contract."}));
  const age=sourceAgeSeconds(snapshotAt,now);
  if(age===null||age>86400)findings.push({code:"snapshot_freshness",source:"data/supabase-snapshot.json",note:age===null?"Unknown age or clock skew.":"Snapshot exceeds the 24-hour backup freshness threshold."});
  for(const name of activeNames.filter(n=>/^sync-(live|matches) \(every 5m\)$/.test(n)&&!runs.some(r=>r.name===n)))findings.push({code:"schedule_not_observed",source:name,note:"No scheduled main run in the bounded GitHub sample; cadence cannot be verified."});
  for(const run of runs){
    if(!activeNames.includes(run.name)||!/^sync-(live|matches) \(every 5m\)$/.test(run.name))continue;
    const elapsed=sourceAgeSeconds(run.latestCreatedAt,now);
    if(elapsed!==null&&elapsed>900)findings.push({code:"schedule_gap",source:run.name,note:"Latest recorded scheduled run exceeds 15 minutes (3x configured cadence). This is scheduler degradation, not measured score latency."});
  }
  return findings;
}
