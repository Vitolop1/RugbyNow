import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import top14 from '../data/top14-calendar.json';
import squads from '../data/team-squads.json';
import institutions from '../data/club-information.json';
import {parseProD2CalendarRound,validateProD2Calendar} from '../lib/proD2Calendar';
import {getLnrCalendarData} from '../lib/proD2CalendarData';
import {parseLnrSquad,validateSquadIdentities,type TeamSquad} from '../lib/squads';
import {parseUrbaCalendar} from '../lib/urbaCalendar';
import {getUrbaCalendarData} from '../lib/urbaCalendarData';
import urbaSource from './fixtures/urba-calendar.json';
import {parseLnrLiveObservation} from '../lib/lnrLiveObservation';
import {lnrMonitorCompetitions,runLnrLiveMonitor,LIVE_MONITOR_KEY} from '../lib/lnrLiveMonitor';
import {getPlayerUpdates} from '../lib/playerUpdates';
import {getSnapshotLeagueData} from '../lib/supabaseSnapshot';
import {areLogicalMatchDuplicates} from '../lib/matchIntegrity';
import {parseLnrProD2Broadcasts} from '../lib/lnrBroadcasts';
import {getConfirmedMatchBroadcasts} from '../lib/matchBroadcasts';
import {getCoverageInventory} from '../lib/coverage';

const source=fs.readFileSync('tests/fixtures/top14-j7.html','utf8');
test('Top 14 official calendar contains all 182 regular fixtures and keeps 119 unconfirmed dates',()=>{
 validateProD2Calendar(top14.fixtures,'fr-top14');
 assert.equal(top14.fixtures.length,182);assert.equal(top14.fixtures.filter(m=>!m.date).length,119);
 const round=parseProD2CalendarRound(source,'2026/2027',7,'fr-top14');assert.equal(round.length,7);
 assert.equal(round.find(m=>m.homeSlug==='stade-rochelais')?.startsAt,'2026-10-25T20:05:00.000Z');
 assert.throws(()=>parseProD2CalendarRound(source,'2025/2026',7,'fr-top14'));
 assert.throws(()=>validateProD2Calendar(top14.fixtures.slice(1),'fr-top14'));
 assert.throws(()=>validateProD2Calendar([...top14.fixtures.slice(1),top14.fixtures[1]],'fr-top14'));
 const calendar=getLnrCalendarData('fr-top14')!;
 assert.equal(calendar.matches.length+calendar.pending.length,182);
 assert.ok(calendar.matches.every(m=>m.home_team.id>0&&m.away_team.id>0));
});
test('season squads use an explicit source edition, preserve all 30 identities and never infer the year',()=>{
 assert.equal(squads.squads.length,30);
 assert.ok(squads.squads.every(s=>s.season==='2026/2027'&&s.kind==='season-squad'&&s.seasonEvidence.includes('(2026-2027)')));
 const players=squads.squads.flatMap(s=>s.players);assert.equal(new Set(players.map(p=>p.id)).size,players.length);
 assert.equal(institutions.clubs.length,30);
 const markup='<h2>Effectif et staff du club</h2>'+Array.from({length:20},(_,i)=>`<a href="https://top14.lnr.fr/joueur/${i+1}-player-${i}" class="player-block "><p class="player-block__name">Player ${i}</p><p class="player-block__position">Centre</p></a>`).join('');
 const dated='<meta name="description" content="Découvrez tout l’effectif de Club (2026-2027) par poste">'+markup;
 assert.equal(parseLnrSquad(dated,'club','https://top14.lnr.fr/club/club/effectif-staff').season,'2026/2027');
 assert.equal(parseLnrSquad(markup,'club','https://top14.lnr.fr/club/club/effectif-staff').kind,'club-directory');
 assert.throws(()=>parseLnrSquad(dated.replace('(2026-2027)','(2026-2029)'),'club','https://top14.lnr.fr/club/club/effectif-staff'));
 validateSquadIdentities(squads.squads as TeamSquad[]);
 const coverage=getCoverageInventory();
 assert.equal(coverage.find(c=>c.slug==='fr-top14'&&c.season==='2026/2027')?.seasonSquads,14);
 assert.ok(coverage.filter(c=>c.season==='2025/2026').every(c=>c.seasonSquads===0&&c.players===0));
 assert.throws(()=>validateSquadIdentities([squads.squads[0],{...squads.squads[0],teamSlug:'another-club'}] as TeamSquad[]));
});
test('URBA all 26 rounds reconcile to official team statistics and retain 70 previously missing results',()=>{
 const calendar=parseUrbaCalendar(urbaSource);assert.equal(calendar.fixtures.length,182);
 const resolved=getUrbaCalendarData();assert.equal(resolved.matches.filter(m=>m.id<0).length,70);
 const fallback=getSnapshotLeagueData('ar-urba-top14','2026-10-21',null,true,'2026')!;
 assert.equal(fallback.matches.length,184);assert.ok(fallback.matches.some(m=>m.match_date==='2026-03-14'));
 assert.equal(new Set(resolved.matches.map(m=>m.id)).size,182);
 assert.ok(resolved.matches.every(m=>m.status==='FT'&&m.home_team.id>0&&m.away_team.id>0));
 const match=resolved.matches.find(m=>m.round===26&&m.home_team.slug==='alumni')!;
 assert.equal(match.home_score,14);assert.equal(match.away_score,22);
 const changed=structuredClone(urbaSource);changed.championship.rounds[0].matches[0].local_team_score++;
 assert.throws(()=>parseUrbaCalendar(changed),/disagree/);
 assert.throws(()=>parseUrbaCalendar({...urbaSource,championship:{...urbaSource.championship,rounds:urbaSource.championship.rounds.slice(1)}}));
 const wrongEdition=structuredClone(urbaSource);wrongEdition.championship.rounds[0].playdate='2025-03-14T00:00:00';assert.throws(()=>parseUrbaCalendar(wrongEdition));
});
test('an unknown historical kickoff never merges a regular result with a later playoff',()=>{
 const regular={id:1,matchDate:'2026-03-14',kickoffTime:null,status:'FT',homeScore:27,awayScore:25,homeTeamId:1,awayTeamId:2};
 assert.equal(areLogicalMatchDuplicates(regular,{...regular,id:2,matchDate:'2026-10-30',kickoffTime:'23:10:00',status:'NS',homeScore:null,awayScore:null}),false);
 assert.equal(areLogicalMatchDuplicates(regular,{...regular,id:3,kickoffTime:'18:30:00'}),true);
});
test('LNR observations rely only on explicit states, preserve 0–0 and reject wrong editions and partial rounds',()=>{
 const observed=parseLnrLiveObservation(source,'fr-top14','2026-10-21T00:00:00Z');
 assert.equal(observed.matches.length,7);assert.ok(observed.matches.every(m=>m.status==='NS'&&m.minute===null&&m.homeScore===null));
 const playing=source.replace('"status":"not-started"','"status":"live"');
 const live=parseLnrLiveObservation(playing,'fr-top14','2026-10-21T00:00:00Z');
 assert.equal(live.matches[0].status,'LIVE');assert.equal(live.matches[0].homeScore,0);assert.equal(live.matches[0].minute,null);
 assert.throws(()=>parseLnrLiveObservation(source.replace('"status":"not-started"','"status":"unknown"'),'fr-top14','2026-10-21T00:00:00Z'));
 assert.throws(()=>parseLnrLiveObservation(source,'fr-top14','2026-10-21T00:00:00Z','2025/2026'));
});
test('Top 14 television uses exact aliases, source kickoff and France without granting global rights',()=>{
 const listings=parseLnrProD2Broadcasts(source,'2026-10-21T00:00:00Z','fr-top14');assert.equal(listings.length,7);
 const query={competitionSlug:'fr-top14',home:'Bayonne',away:'Lyon',startsAt:'2026-10-24T14:35:00Z',country:'FR'};
 const guide=getConfirmedMatchBroadcasts(query,listings)!;assert.ok(guide.providers.some(p=>p.id==='canal-plus'));
 assert.equal(getConfirmedMatchBroadcasts({...query,country:'AR'},listings),null);
 assert.equal(getConfirmedMatchBroadcasts({...query,startsAt:'2026-10-24T15:35:00Z'},listings),null);
 assert.equal(getConfirmedMatchBroadcasts({...query,competitionSlug:'fr-pro-d2'},listings),null);
});
test('independent monitoring skips quiet windows and never writes fabricated match results',async()=>{
 const stored=new Map<string,string>();const bucket={put:async(k:string,v:string)=>{stored.set(k,v);},get:async()=>null};
 let requests=0;
 const report=await runLnrLiveMonitor(bucket,Date.parse('2026-10-21T00:00:00Z'),(async()=>{requests++;throw Error('offline');}) as typeof fetch);
 assert.equal(report.status,'idle');assert.equal(requests,0);assert.equal(report.writesResults,false);assert.ok(stored.has(LIVE_MONITOR_KEY));
 assert.ok(lnrMonitorCompetitions(Date.parse('2026-10-24T13:00:00Z')).includes('fr-top14'));
});
test('source failure retries twice and preserves the last valid independent observation',async()=>{
 const key='rugbynow-monitor/fr-top14.json',stored=new Map([[key,'last valid']]);
 let requests=0;const bucket={put:async(k:string,v:string)=>{stored.set(k,v);},get:async()=>null};
 const report=await runLnrLiveMonitor(bucket,Date.parse('2026-10-24T13:00:00Z'),(async()=>{requests++;return new Response('Unavailable',{status:503});}) as typeof fetch);
 assert.equal(requests,2);assert.equal(report.status,'failed');assert.equal(stored.get(key),'last valid');
});
test('independent monitor stores a complete source observation separately from its heartbeat',async()=>{
 const stored=new Map<string,string>();const bucket={put:async(k:string,v:string)=>{stored.set(k,v);},get:async()=>null};
 const report=await runLnrLiveMonitor(bucket,Date.parse('2026-10-24T13:00:00Z'),(async()=>new Response(source)) as typeof fetch);
 assert.equal(report.status,'observed');assert.equal(report.writesResults,false);
 const observation=JSON.parse(stored.get('rugbynow-monitor/fr-top14.json')!);assert.equal(observation.matches.length,7);
 assert.equal(report.sources[0].active,0); // A successful scheduled read still does not prove a changing live score.
});
test('medical bulletins remain dated without predicted recovery and loans link both real clubs',()=>{
 const medical=getPlayerUpdates('stade-toulousain');assert.equal(medical.length,9);
 assert.ok(medical.every(u=>u.publishedAt==='2026-10-16'&&u.expectedReturn===null&&u.availability===null));
 assert.ok(getPlayerUpdates('soyaux-angouleme').some(u=>u.kind==='loan'&&u.origin==='Provence Rugby'));
});
