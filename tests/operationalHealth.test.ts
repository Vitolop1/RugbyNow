import assert from "node:assert/strict";
import test from "node:test";
import {distribution,healthFindings,parseMatchId,probeEndpoint,seasonMembershipCount,sourceAgeSeconds,summarizeRuns,type WorkflowRun} from "../lib/operationalHealth";
import squads from "../data/team-squads.json";
import type {TeamSquad} from "../lib/squads";
import matchHandler from "../pages/api/matches/[id]";
import type {NextApiRequest,NextApiResponse} from "next";
test("match API rejects malformed IDs before resolving a fixture",async()=>{
  for(const id of ["16913oops","16913.5",["16913","15883"]]){
    let status=0;const response={status(code:number){status=code;return this;},json(){return this;}};
    await matchHandler({method:"GET",query:{id}} as unknown as NextApiRequest,response as unknown as NextApiResponse);
    assert.equal(status,400);
  }
});
test("roster metrics use the existing season-squad model, excluding directories and call-ups",()=>{
  const stored=squads.squads as TeamSquad[];const expected=stored.filter(s=>s.kind==="season-squad"&&s.season).reduce((n,s)=>n+s.players.length,0);
  assert.ok(expected>0);assert.equal(seasonMembershipCount(stored),expected);
  assert.equal(seasonMembershipCount([{...stored[0],kind:"club-directory"},{...stored[0],kind:"call-up"}]),0);
});
test("match IDs reject numeric prefixes, decimals, arrays and unsafe integers while preserving official negative IDs",()=>{
  for(const value of ["16913oops","16913.5","1e3","0","01"," 16913",["16913"],"9007199254740992",undefined])assert.equal(parseMatchId(value),null);
  assert.equal(parseMatchId("16913"),16913);assert.equal(parseMatchId("-42027"),-42027);
});
test("bounded probes distinguish HTTP success, empty payload, fallback and stale scheduler",async()=>{
  const fake=(json:unknown,status=200)=>(async()=>new Response(JSON.stringify(json),{status})) as typeof fetch;
  const agenda={path:"/api/agenda?date=2026-10-22",expected:200,kind:"agenda" as const};
  assert.equal((await probeEndpoint("https://rugby-now.com",agenda,fake({entries:[],source:"snapshot"}))).source,"snapshot");
  assert.equal((await probeEndpoint("https://rugby-now.com",agenda,fake({}))).ok,false);
  assert.equal((await probeEndpoint("https://rugby-now.com",{...agenda,expected:400},fake({error:"Invalid date"},400))).ok,true);
  const monitor={path:"/api/live-monitor",expected:200,kind:"monitor" as const};
  assert.equal((await probeEndpoint("https://rugby-now.com",monitor,fake({report:null,delayed:false}))).ok,false);
  assert.equal((await probeEndpoint("https://rugby-now.com",monitor,fake({report:{status:"idle"},delayed:true}))).issue,"scheduler_delayed");
});
test("probe failures are bounded and never expose provider exception text",async()=>{
  const target={path:"/news",expected:200,kind:"text" as const};
  const failure=await probeEndpoint("https://rugby-now.com",target,(async()=>{throw new Error("private token=secret");}) as typeof fetch);
  assert.equal(failure.issue,"request_failed");assert.ok(!JSON.stringify(failure).includes("secret"));
  const large=await probeEndpoint("https://rugby-now.com",target,(async()=>new Response("x".repeat(2_000_001))) as typeof fetch);
  assert.equal(large.issue,"payload_limit");
});
test("HTTP 200 HTML is not a valid sitemap, robots file or ads.txt",async()=>{
  const html=(async()=>new Response("<html>Unavailable</html>")) as typeof fetch;
  for(const kind of ["sitemap","robots","ads"] as const)assert.equal((await probeEndpoint("https://rugby-now.com",{path:"/",expected:200,kind},html)).ok,false);
  const xml=(async()=>new Response('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://rugby-now.com/</loc></url></urlset>')) as typeof fetch;
  const result=await probeEndpoint("https://rugby-now.com",{path:"/sitemap.xml",expected:200,kind:"sitemap"},xml);assert.equal(result.ok,true);assert.equal(result.documentEntries,1);
});
test("freshness keeps clock skew unknown and separates scheduler timing from source timing",()=>{
  assert.equal(sourceAgeSeconds("2026-10-22T12:00:00Z","2026-10-22T12:01:00Z"),60);
  assert.equal(sourceAgeSeconds("2026-10-22T12:02:00Z","2026-10-22T12:01:00Z"),null);
  assert.equal(sourceAgeSeconds(undefined,"2026-10-22T12:01:00Z"),null);
  assert.deepEqual(distribution([]),{n:0,mean:null,p50:null,p95:null,max:null});
});
test("workflow intervals use actual scheduled runs, retaining failures and excluding manual/PR jobs",()=>{
  const base:WorkflowRun={id:1,name:"live",event:"schedule",head_branch:"main",status:"completed",conclusion:"success",created_at:"2026-10-22T00:00:00Z",run_started_at:"2026-10-22T00:00:00Z",updated_at:"2026-10-22T00:01:00Z"};
  const [summary]=summarizeRuns([base,{...base,id:2,conclusion:"failure",created_at:"2026-10-22T03:00:00Z"},{...base,event:"workflow_dispatch"},{...base,event:"pull_request"}]);
  assert.equal(summary.runs,2);assert.equal(summary.failed,1);assert.equal(summary.observedGapsMinutes.max,180);
});
test("degradation detects stale backups and delayed active schedules without treating disabled legacy jobs as outages",()=>{
  const run:WorkflowRun={id:1,name:"sync-live (every 5m)",event:"schedule",head_branch:"main",status:"completed",conclusion:"success",created_at:"2026-10-22T00:00:00Z",run_started_at:"2026-10-22T00:00:00Z",updated_at:"2026-10-22T00:01:00Z"};
  const summaries=summarizeRuns([run]);
  const findings=healthFindings([],"2026-10-20T00:00:00Z",summaries,[run.name],"2026-10-22T03:00:00Z");
  assert.deepEqual(findings.map(f=>f.code),["snapshot_freshness","schedule_gap"]);
  assert.deepEqual(healthFindings([],"2026-10-22T02:59:00Z",summaries,[],"2026-10-22T03:00:00Z"),[]);
  assert.equal(healthFindings([],"2026-10-22T02:59:00Z",[],[run.name],"2026-10-22T03:00:00Z")[0].code,"schedule_not_observed");
});
