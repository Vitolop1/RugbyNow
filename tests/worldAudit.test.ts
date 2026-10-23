import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import type {SupabaseClient} from "@supabase/supabase-js";
import {parseProD2Standings} from "../lib/officialStandings";
import {usableCachedStandings,requireStandingsEdition} from "../lib/sourceStandings";
import {worldCup2027Matches} from "../lib/worldCup2027";
import {parseLnrSquad} from "../lib/squads";
import {selectFeaturedMatches} from "../lib/featuredMatches";
import type {DailyEntry} from "../lib/dailyAgenda";
import {updateObservedMatch,validateMatchObservation} from "../lib/conditionalMatchWrite";
import {isArchivedPlayerUpdate} from "../lib/playerUpdates";
import {parseEpcrStandings} from "../lib/epcrStandings";
import {parseProD2CalendarRound,validateProD2Calendar} from "../lib/proD2Calendar";
import proCalendar from "../data/pro-d2-calendar.json";
import {teamDisciplineSelection} from "../lib/teamDiscipline";
import {appendSourceStatusDetail,readSourceStatusDetail,detectSourceStatusDetail} from "../lib/sourceStatusDetail";
import {withOfficialStandings} from "../lib/standingsOverlay";
import officialTables from "../data/official-standings.json";
import snapshot from "../data/supabase-snapshot.json";

test("official tables resolve actual stable club IDs even without a previous cache",()=>{
 for(const table of officialTables.tables){
  const result=withOfficialStandings({competition:{slug:table.competitionSlug},season:{name:table.season},standings:[],standingsSource:"unavailable"});
  assert.equal(result.standingsSource,"official");assert.equal(result.standings.length,table.rows.length);
  const rows=result.standings as {teamId:number;teamSlug:string}[];
  assert.equal(new Set(rows.map(r=>r.teamId)).size,rows.length);
  assert.ok(rows.every(row=>row.teamId>0&&snapshot.teams.some(team=>team.id===row.teamId&&team.slug===row.teamSlug)));
 }
});

test("EPCR tables keep all groups and published differences without invented PF/PA",()=>{
 for(const [file,competition,count] of [["epcr-pools.html","champions-cup",24],["epcr-challenge-pools.html","challenge-cup",18]] as const){
  const html=fs.readFileSync(`tests/fixtures/${file}`,"utf8"),table=parseEpcrStandings(html,competition);
  assert.equal(table.rows.length,count);assert.equal(table.rows.filter(r=>r.position===1).length,count/6);assert.ok(table.rows.every(r=>r.pf===null&&r.pa===null&&Number.isInteger(r.difference)));
  assert.throws(()=>parseEpcrStandings(html.replace(/<table[\s\S]*?<\/table>/,""),competition));
 }
});

test("Pro D2 calendar preserves explicit Saturday and leaves round windows undated",()=>{
 const seventh=parseProD2CalendarRound(fs.readFileSync("tests/fixtures/pro-d2-j7.html","utf8"),"2026/2027",7);
 assert.ok(seventh.some(m=>m.date==="2026-10-17"));
 const last=parseProD2CalendarRound(fs.readFileSync("tests/fixtures/pro-d2-j30.html","utf8"),"2026/2027",30);
 assert.ok(last.every(m=>m.date===null&&m.startsAt===null));
 validateProD2Calendar(proCalendar.fixtures);assert.equal(proCalendar.fixtures.length,240);
 assert.throws(()=>validateProD2Calendar(proCalendar.fixtures.slice(0,-1)));
});

test("XV and seven remain separate even when a national team shares an ID",()=>{
 const slugs=["svns-dubai","int-world-cup","int-nations-championship"];
 assert.deepEqual(teamDisciplineSelection(slugs),{available:["rugby-sevens","rugby-union"],selected:"rugby-union"});
 assert.equal(teamDisciplineSelection(slugs,"rugby-sevens").selected,"rugby-sevens");
 assert.equal(teamDisciplineSelection(slugs,"unknown").selected,"rugby-union");
});

test("source status qualifiers preserve phases and do not invent a playing clock",()=>{
 const url=appendSourceStatusDetail("https://example.com/match#rn_phase=pool","suspended");
 assert.equal(readSourceStatusDetail(url),"suspended");assert.equal(new URLSearchParams(new URL(url).hash.slice(1)).get("rn_phase"),"pool");
 assert.equal(detectSourceStatusDetail("POSTP"),"postponed");assert.equal(detectSourceStatusDetail("AET"),"after-extra-time");
 assert.equal(readSourceStatusDetail(appendSourceStatusDetail(url,null)),null);
});

test("official LNR table keeps sixteen clubs, published bonus and ranking instead of recalculating points",()=>{
 const html=fs.readFileSync("tests/fixtures/lnr-pro-d2-table.html","utf8");const table=parseProD2Standings(html,"2026-10-20T12:00:00Z");
 assert.equal(table.season,"2026/2027");assert.equal(table.rows.length,16);assert.equal(table.rows[0].slug,"oyonnax");assert.equal(table.rows[0].bonus,5);assert.equal(table.rows[0].pts,33);
 assert.throws(()=>parseProD2Standings(html.replace('313','314')));assert.throws(()=>parseProD2Standings(html.slice(0,html.lastIndexOf('<div class="table-line table-line--ranking-full'))));
});
test("cache presentation rejects partial tables, missing statistics, gaps and unresolved identities",()=>{
 const teams=new Map(Array.from({length:16},(_,i)=>[i+1,{name:`Club ${i+1}`} ]));
 const rows=[...teams.keys()].map(id=>({team_id:id,position:id,played:0,won:0,drawn:0,lost:0,points_for:0,points_against:0,points:0}));
 assert.equal(usableCachedStandings(rows,teams,"fr-pro-d2","2026/2027"),true);
 assert.equal(usableCachedStandings(rows.slice(0,15),teams,"fr-pro-d2","2026/2027"),false);
 assert.equal(usableCachedStandings([{...rows[0],played:null},...rows.slice(1)],teams,"fr-pro-d2","2026/2027"),false);
 assert.equal(usableCachedStandings([{...rows[0],team_id:99},...rows.slice(1)],teams,"fr-pro-d2","2026/2027"),false);
 assert.equal(usableCachedStandings([{...rows[0],position:17},...rows.slice(1)],teams,"fr-pro-d2","2026/2027"),false);
 requireStandingsEdition("2026-2027","2026/2027");assert.throws(()=>requireStandingsEdition("2025/2026","2026/2027"));assert.throws(()=>requireStandingsEdition("Current","2026/2027"));
});
test("World Cup 2027 contains all 52 official fixtures, correct venue time zones and sixteen conditional crossings",()=>{
 const matches=worldCup2027Matches();assert.equal(matches.length,52);assert.equal(new Set(matches.map(m=>m.id)).size,52);
 for(const pool of ["A","B","C","D","E","F"]){const rows=matches.filter(m=>m.pool===pool);assert.equal(rows.length,6);assert.equal(new Set(rows.flatMap(m=>[m.home_team.slug,m.away_team.slug])).size,4);}
 assert.equal(matches.filter(m=>m.conditional).length,16);assert.ok(matches.filter(m=>m.conditional).every(m=>m.home_team.slug===null&&m.away_team.slug===null&&m.home_score===null));
 assert.equal(matches[11].match_date+"T"+matches[11].kickoff_time+"Z","2027-10-04T08:45:00Z");assert.equal(matches[27].kickoff_time,"02:45:00");assert.equal(matches[51].kickoff_time,"09:00:00");
});

test("official calendar enrichment preserves a real live observation and zero score",()=>{
 const first=worldCup2027Matches()[0];
 const observed=worldCup2027Matches([{id:first.id,status:"LIVE",minute:12,home_score:7,away_score:0,updated_at:"2027-10-01T11:00:00.000Z",source_url:"https://example.com/live"}])[0];
 assert.equal(observed.status,"LIVE");assert.equal(observed.minute,12);assert.equal(observed.away_score,0);assert.equal(observed.source_url,"https://example.com/live");assert.equal(observed.kickoff_time,first.kickoff_time);
 const suspended=appendSourceStatusDetail("https://example.com/live","suspended");
 validateMatchObservation({status:"LIVE",source_url:suspended,updated_at:"2026-10-20T12:00:00.000Z"});
});
test("player directory retains namespaced identity and country without fabricating a season",()=>{
 const block=(i:number)=>`<a href="https://prod2.lnr.fr/joueur/${i}-player" class="player-block "><img alt="Player ${i}" class="player-block__player-img"/><img alt="France" class="player-block__country player-block__small-img"/><p class="player-block__name">Player ${i}</p><p class="player-block__position">Centre</p></a>`;
 const html="Effectif et staff du club"+Array.from({length:20},(_,i)=>block(i+1)).join("");const squad=parseLnrSquad(html,"oyonnax","https://prod2.lnr.fr/club/oyonnax/effectif-staff");
 assert.equal(squad.season,null);assert.equal(squad.kind,"club-directory");assert.equal(squad.players[0].country,"France");assert.equal(squad.players[0].id,"lnr-1");assert.throws(()=>parseLnrSquad(html+block(1),"oyonnax","source"));assert.throws(()=>parseLnrSquad(html.replace('class="player-block__name">Player 1','class="player-block__name">'),"oyonnax","source"));
});
test("featured fixtures respect hidden leagues, past pending games, local date and the two-match limit",()=>{
 const make=(id:string,slug:string,start:string,status="NS"):DailyEntry=>({id,competitionSlug:slug,competition:slug,home:slug,away:"B",kind:"match",startsAt:start,date:start.slice(0,10),status,minute:null,homeScore:null,awayScore:null,region:"international",providers:[],transmissionPending:true});
 const entries=[make("1","fr-pro-d2","2026-10-22T19:00:00Z"),make("2","hidden","2026-10-22T18:00:00Z"),make("3","other","2026-10-22T20:00:00Z"),make("4","other","2026-10-22T21:00:00Z"),make("5","past","2026-10-20T01:00:00Z")];
 const selected=selectFeaturedMatches(entries,"2026-10-20","America/New_York",Date.parse("2026-10-20T12:00:00Z"),{leagues:[],clubs:[],hidden:["hidden"]});
 assert.deepEqual(selected.map(m=>m.id),["1","3"]);
});
test("conditional database update rejects incomplete scores and filters stale observations atomically",async()=>{
 validateMatchObservation({status:"LIVE",home_score:0,away_score:0,updated_at:"2026-10-20T12:00:00.000Z"});
 assert.throws(()=>validateMatchObservation({status:"FT",home_score:null,away_score:0,updated_at:"2026-10-20T12:00:00.000Z"}));
 const calls:string[]=[];const query={eq:(key:string,value:unknown)=>{calls.push(`eq:${key}:${value}`);return query;},or:(value:string)=>{calls.push(value);return query;},neq:(key:string,value:unknown)=>{calls.push(`neq:${key}:${value}`);return query;},select:()=>query,abortSignal:async()=>({data:[],error:null})};
 const client={from:()=>({update:()=>query})} as unknown as SupabaseClient;
 const changed=await updateObservedMatch(client,1,{status:"LIVE",home_score:14,away_score:0,updated_at:"2026-10-20T12:00:00.000Z"});
 assert.equal(changed,false);assert.ok(calls.includes("updated_at.is.null,updated_at.lte.2026-10-20T12:00:00.000Z"));assert.ok(calls.includes("neq:status:FT"));
 calls.length=0;
 await updateObservedMatch(client,1,{status:"NS",home_score:null,away_score:null,updated_at:"2026-10-20T12:01:00.000Z"});
 assert.ok(calls.includes("neq:status:LIVE"));assert.ok(calls.includes("neq:status:HT"));
 calls.length=0;
 await updateObservedMatch(client,1,{status:"NS",source_url:"https://www.flashscore.com/rugby-union/#rn_status=delayed",updated_at:"2026-10-20T12:02:00.000Z"});
 assert.ok(!calls.includes("neq:status:LIVE"));
 assert.equal(isArchivedPlayerUpdate({publishedAt:"2026-09-21"},Date.parse("2026-10-20T12:00:00Z")),true);
});
