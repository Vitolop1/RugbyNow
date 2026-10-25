import fs from "node:fs";
import path from "node:path";
import type {TeamSquad} from "../lib/squads";
import {distribution,healthFindings,probeEndpoint,record,seasonMembershipCount,sourceAgeSeconds,summarizeRuns,type HealthMetric,type Probe,type ProbeTarget,type WorkflowRun} from "../lib/operationalHealth";

async function main(){
const args=process.argv.slice(2),option=(name:string,fallback:string)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const base=new URL(option("base","https://rugby-now.com"));
if(base.username||base.password||base.search||base.hash||base.pathname!=="/"||!["https:","http:"].includes(base.protocol)
  ||(base.protocol==="http:"&&!["localhost","127.0.0.1"].includes(base.hostname)))throw new Error("Use an HTTPS origin or local HTTP origin, without credentials, path or query.");
const samples=Number(option("samples","3"));if(!Number.isInteger(samples)||samples<1||samples>3)throw new Error("samples must be 1..3");
const out=option("out","logs/operational-health"),start=new Date().toISOString(),date=start.slice(0,10);
const metrics:HealthMetric[]=[],probes:Probe[]=[];
function metric(area:HealthMetric["area"],name:string,value:number|string|null,unit:string,period:string,source:string,note?:string){
  metrics.push({area,name,value,unit,period,source,observedAt:new Date().toISOString(),verification:value===null?"unavailable":"observed",...(note?{note}:{})});
}
const targets:ProbeTarget[]=[
  {path:`/api/agenda?date=${date}`,expected:200,kind:"agenda"},
  {path:"/api/competitions",expected:200,kind:"catalog"},
  {path:"/api/leagues/fr-pro-d2",expected:200,kind:"league"},
  {path:"/api/teams/montauban",expected:200,kind:"team"},
  {path:"/api/matches/16913?competition=fr-pro-d2",expected:200,kind:"match"},
  {path:"/api/preferences-catalog",expected:200,kind:"preferences"},
  {path:"/api/live-monitor",expected:200,kind:"monitor"},
];
// Sequential, at most 21 API GETs plus six one-shot checks. No load test or retries.
for(const target of targets)for(let i=0;i<samples;i++)probes.push(await probeEndpoint(base.origin,target));
for(const target of [
  {path:"/api/agenda?date=2026-02-30",expected:400,kind:"agenda"},
  {path:"/api/matches/16913oops",expected:400,kind:"match"},
  {path:"/news",expected:200,kind:"text"},
  {path:"/robots.txt",expected:200,kind:"robots"},
  {path:"/sitemap.xml",expected:200,kind:"sitemap"},
  {path:"/ads.txt",expected:200,kind:"ads"},
] as ProbeTarget[])probes.push(await probeEndpoint(base.origin,target));
const period=`${start} / ${new Date().toISOString()}`;
metric("SEO","URLs in public sitemap",probes.find(p=>p.path==="/sitemap.xml")?.documentEntries??null,"URLs",period,`${base.origin}/sitemap.xml`,"Public XML inventory, not Google indexed or discovered page count.");
for(const target of [...new Map(probes.map(p=>[p.path,p])).values()]){
  const observations=probes.filter(p=>p.path===target.path),latency=distribution(observations.map(p=>p.ms));
  for(const [key,value] of Object.entries(latency))metric("Backend",`${target.path}: ${key}`,value,key==="n"?"observations":"ms",period,base.origin,
    "Short controlled baseline, includes body download; empirical percentiles, not historical uptime or an SLO.");
  metric("Backend",`${target.path}: expected responses`,100*observations.filter(p=>p.ok).length/observations.length,"% of probes",period,base.origin);
}
const snapshots=probes.filter(p=>["/api/agenda", "/api/leagues", "/api/matches"].some(prefix=>p.path.startsWith(prefix))&&p.expected===200&&p.ok);
metric("Backend","snapshot responses on database-capable endpoints",snapshots.filter(p=>p.source==="snapshot").length,"observations",period,base.origin,"Team profiles intentionally use versioned snapshots and are excluded. Not a historical fallback rate.");
const monitor=probes.filter(p=>p.path==="/api/live-monitor").at(-1);
metric("Datos deportivos","live source-to-screen latency",null,"seconds",period,"source → database → API → screen","No instrumented real match sample. A heartbeat or idle report does not measure a score update.");
metric("Automatizaciones","monitor state",monitor?.monitorStatus??null,"state",period,`${base.origin}/api/live-monitor`);

// Read-only local versioned data. No Supabase service key is loaded or needed.
const read=(name:string)=>JSON.parse(fs.readFileSync(path.join("data",`${name}.json`),"utf8"));
const snapshot=read("supabase-snapshot") as {generatedAt:string;competitions:unknown[];seasons:{id:number;name:string}[];teams:unknown[];matches:{match_date:string;kickoff_time:string|null;status:string;home_score:number|null;away_score:number|null;updated_at?:string|null}[]};
for(const key of ["competitions","seasons","teams","matches"] as const)metric("Datos deportivos",`snapshot ${key}`,snapshot[key].length,"records",snapshot.generatedAt,"data/supabase-snapshot.json","Versioned snapshot inventory; not a direct database count or proof of complete tournament coverage.");
metric("Datos deportivos","snapshot age",sourceAgeSeconds(snapshot.generatedAt,new Date().toISOString()),"seconds",start,"data/supabase-snapshot.json");
for(const [name,count] of [
  ["matches with recorded date",snapshot.matches.filter(m=>m.match_date).length],
  ["matches with recorded kickoff",snapshot.matches.filter(m=>m.kickoff_time).length],
  ["historical dates",snapshot.matches.filter(m=>m.match_date<date).length],
  ["today/future dates",snapshot.matches.filter(m=>m.match_date>=date).length],
  ["historical dates without confirmed FT/CANC",snapshot.matches.filter(m=>m.match_date<date&&!["FT","CANC"].includes(m.status)).length],
  ["FT missing scores",snapshot.matches.filter(m=>m.status==="FT"&&(m.home_score===null||m.away_score===null)).length],
] as const)metric("Datos deportivos",name,count,"records",snapshot.generatedAt,"data/supabase-snapshot.json","Recorded dates can be provisional. Official calendar windows and overlays are separate; no status is inferred from elapsed time.");
const tables=read("official-standings").tables as {competitionSlug:string;season:string;checkedAt:string;sourceUrl:string;rows:unknown[]}[];
metric("Datos deportivos","official tables with source evidence",tables.filter(t=>t.sourceUrl&&t.checkedAt&&t.rows.length).length,"tables",start,"data/official-standings.json","Stored evidence only; sources not re-scraped by this audit.");
const squads=read("team-squads").squads as TeamSquad[];
metric("Datos deportivos","clubs with squads",new Set(squads.map(s=>s.teamSlug)).size,"clubs",start,"data/team-squads.json");
metric("Datos deportivos","season-associated player memberships",seasonMembershipCount(squads),"memberships",start,"data/team-squads.json","Memberships, not necessarily unique people across seasons.");
for(const file of ["pro-d2-calendar","top14-calendar","urba-calendar","world-cup-2027"]){
  const calendar=read(file);const rows=(calendar.fixtures??calendar.matches) as Record<string,unknown>[];
  for(const [name,count] of [["fixtures",rows.length],["published dates",rows.filter(r=>r.date||r.startsAt).length],["published kickoffs",rows.filter(r=>r.startsAt).length]] as const)
    metric("Datos deportivos",`${file} ${calendar.season}: ${name}`,count,"fixtures",calendar.checkedAt,`data/${file}.json`,"Official overlays counted separately; do not add to database snapshot totals. Windows are not confirmed dates.");
}
const news=read("news-snapshot") as {generatedAt:string;items:{publishedAt:string}[];feeds:{sourceId:string;ok:boolean;checkedAt:string;count:number}[]};
metric("Datos deportivos","news snapshot items",news.items.length,"headlines",news.generatedAt,"data/news-snapshot.json");
metric("Datos deportivos","headlines published in previous 24h",news.items.filter(n=>Date.parse(n.publishedAt)<=Date.now()&&Date.parse(n.publishedAt)>=Date.now()-86400000).length,"headlines",`${date} trailing 24h`,"data/news-snapshot.json","Publication dates, not count newly imported since the last run.");
metric("Datos deportivos","newly imported news since previous run",null,"records",period,"news importer","No before/after import record available in this read-only baseline.");
const broadcasts=read("match-broadcasts").listings as {checkedAt:string}[];
metric("Datos deportivos","territorial match TV confirmations",broadcasts.length,"listings",start,"data/match-broadcasts.json","A territorial listing is not a unique match or worldwide broadcast right.");
const sourceEvidence=[...tables.map(t=>({source:`standings:${t.competitionSlug}:${t.season}`,checkedAt:t.checkedAt})),
  ...squads.map(s=>({source:`squad:${s.teamSlug}:${s.season??"directory"}`,checkedAt:s.checkedAt})),
  ...news.feeds.map(f=>({source:`news:${f.sourceId}`,checkedAt:f.checkedAt,ok:f.ok,processed:f.count})),
  ...broadcasts.map((b,i)=>({source:`broadcast:${i}`,checkedAt:b.checkedAt}))].map(row=>({...row,
    lastAttemptAt:"ok" in row?row.checkedAt:null,
    lastSuccessfulCheckAt:!("ok" in row)||row.ok?row.checkedAt:null,
    checkedAgeSeconds:sourceAgeSeconds(row.checkedAt,new Date().toISOString()),
    lastSourceContentChangeAt:null,note:"Stored evidence. Last attempt is unknown unless the feed records it; checking is not a content change."}));

let workflows:unknown[]=[],runsSummary:ReturnType<typeof summarizeRuns>=[],prs:unknown[]=[],githubIssue:string|null=null;
async function github(suffix:string){
  const response=await fetch(`https://api.github.com/repos/Vitolop1/RugbyNow/${suffix}`,{headers:{Accept:"application/vnd.github+json",...(process.env.GITHUB_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}:{})},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error("github_unavailable");return record(await response.json());
}
try{
  const data=await github("actions/runs?per_page=100");const runs=data.workflow_runs as WorkflowRun[];
  runsSummary=summarizeRuns(runs);
  const inventory=await github("actions/workflows");workflows=(inventory.workflows as Record<string,unknown>[]).map(w=>({name:w.name,path:w.path,state:w.state}));
  const response=await fetch("https://api.github.com/repos/Vitolop1/RugbyNow/pulls?state=open&per_page=30",{headers:{Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(12000)});
  if(response.ok)prs=((await response.json()) as Record<string,unknown>[]).map(p=>({number:p.number,title:p.title,base:record(p.base).ref,head:record(p.head).ref}));
  for(const summary of runsSummary){metric("Automatizaciones",`${summary.name}: maximum observed creation gap`,summary.observedGapsMinutes.max,"minutes",`${runs.at(-1)?.created_at} / ${runs[0]?.created_at}`,"GitHub Actions API, latest <=100 runs","Bounded sample of recorded runs; jobs never created cannot be enumerated. Configured cron is not guaranteed cadence.");}
}catch{githubIssue="GitHub unavailable or rate limited; no secrets or raw errors included.";}
for(const [area,names,source] of [
  ["SEO",["indexed pages","organic clicks","impressions","CTR","average position"],"Search Console"],
  ["Analytics",["active users","sessions","engagement","internal traffic exclusion"],"Google Analytics 4"],
  ["Monetización",["AdSense approval","ad impressions","ad coverage","estimated revenue","page RPM"],"AdSense"],
] as const)for(const name of names)metric(area,name,null,"account metric",period,source,"Private account metrics are not scraped or published by this runner. Read authorized UI reports separately; unavailable never means zero.");
const findings=healthFindings(probes,snapshot.generatedAt,runsSummary,workflows.map(record).filter(w=>w.state==="active").map(w=>String(w.name)),new Date().toISOString());
for(const feed of news.feeds.filter(f=>!f.ok))findings.push({code:"news_feed_failed",source:feed.sourceId,note:"Last feed attempt was unsuccessful; snapshot data may have been retained."});
const report={schemaVersion:1,startedAt:start,finishedAt:new Date().toISOString(),base:base.origin,status:findings.length||githubIssue?"degraded":"checks_passed",findings,
  limitations:["Controlled probes, not 30-day uptime.","No production writes or provider scraping.","Snapshot totals exclude official overlays and are not full global coverage.","No private Google data in artifacts."],
  metrics,probes,sourceEvidence,workflows,runsSummary,prs,githubIssue};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n");
const escape=(v:unknown)=>String(v??"No disponible").replace(/[|\r\n]/g," ");
const markdown=`# RugbyNOW operational baseline\n\n${report.startedAt} — ${report.finishedAt}\n\n${report.limitations.join(" ")}\n\n| Area | Metric | Value | Unit | Period | Source | Verification |\n|---|---|---|---|---|---|---|\n`+
  metrics.map(m=>`| ${[m.area,m.name,m.value,m.unit,m.period,m.source,m.verification].map(escape).join(" | ")} |`).join("\n")+`\n\nStatus: ${report.status}.\n${findings.map(f=>`- ${f.code}: ${f.source}. ${f.note}`).join("\n")}\n\nSee report.json for sample counts, notes, source timestamps, failures and workflow intervals. Checks passed does not validate unavailable private metrics or a real live match.\n`;
fs.writeFileSync(path.join(out,"report.md"),markdown);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
console.log(JSON.stringify({report:path.join(out,"report.json"),probes:probes.length,unexpected:probes.filter(p=>!p.ok).map(p=>({path:p.path,issue:p.issue})),githubIssue}));

if(args.includes("--strict")&&report.status!=="checks_passed")process.exitCode=1;
}
void main().catch(()=>{console.error("Operational audit failed before completing; inspect inputs and read access. A partial report is not a successful baseline.");process.exitCode=1;});
