import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sourceRetryDelay,readNonEmptyStandings} from '../lib/sourceRecovery';
import {selectDiscoveryFeed,isDiscoverableFixture,hasDiscoveryIdentities} from '../lib/matchDiscovery';
import {aggregateImportHealth,summarizeImport,type ImportHealth} from '../lib/providerPolicy';
import {runLnrLiveMonitor,compareLnrObservations,isMonitorDelayed} from '../lib/lnrLiveMonitor';
import {parseLnrLiveObservation} from '../lib/lnrLiveObservation';

test('transient empty standings recover once; persistent emptiness never returns a replacement',async()=>{
 let reads=0;
 const recovered=await readNonEmptyStandings(async()=>++reads===1?[]:[{team:'Dogos XV'}]);
 assert.equal(reads,2);assert.equal(recovered[0].team,'Dogos XV');
 reads=0;await assert.rejects(readNonEmptyStandings(async()=>{reads++;return [];}),/previous table preserved/);assert.equal(reads,2);
 reads=0;await assert.rejects(readNonEmptyStandings(async()=>{reads++;throw Error('Wrong edition');}),/Wrong edition/);assert.equal(reads,1);
});

test('backoff honors short cooldowns, never bypasses access restrictions or loops',()=>{
 assert.equal(sourceRetryDelay(503,1),1000);assert.equal(sourceRetryDelay(0,1),1000);
 assert.equal(sourceRetryDelay(429,1,'3'),3000);
 assert.equal(sourceRetryDelay(429,1,'120'),null);
 assert.equal(sourceRetryDelay(429,1,'Wed, 21 Oct 2026 18:00:03 GMT',Date.parse('2026-10-21T18:00:00Z')),3000);
 for(const status of [401,403,404,200])assert.equal(sourceRetryDelay(status,1),null);
 assert.equal(sourceRetryDelay(503,2),null);
});

test('discovery rotates configured feeds without DB fixtures, deduplicates, and stays bounded',()=>{
 const feeds=[{compSlug:'sra',url:'https://example.org/a'},{compSlug:'fr-pro-d2',url:'https://example.org/b'}];
 assert.deepEqual(selectDiscoveryFeed(feeds,[],0),feeds[0]);
 assert.deepEqual(selectDiscoveryFeed([...feeds,feeds[0]],[],300000),feeds[1]);
 assert.deepEqual(selectDiscoveryFeed(feeds,[feeds[0]],0),feeds[1]);
 assert.deepEqual(selectDiscoveryFeed([feeds[0]],[feeds[0]],0),feeds[0]);
 assert.equal(selectDiscoveryFeed([],[],0),null);
 const now=Date.parse('2026-12-31T23:59:00Z'),row={status:'NS',matchDate:'2027-01-01',sourceId:'official-id'};
 assert.equal(isDiscoverableFixture(row,now),true);
 for(const patch of [{status:'LIVE'},{status:'FT'},{sourceId:null},{matchDate:'2026-12-30'},{matchDate:'2027-01-15'},{matchDate:'2027-02-30'}])assert.equal(isDiscoverableFixture({...row,...patch},now),false);
});

test('discovery refuses a similarly named club or category outside the exact competition edition',()=>{
 const seasonTeams=new Set([1,2]);
 assert.equal(hasDiscoveryIdentities(1,2,seasonTeams),true);
 for(const [home,away] of [[1,3],[1,1],[null,2],[-1,2]])assert.equal(hasDiscoveryIdentities(home,away,seasonTeams),false);
 assert.equal(hasDiscoveryIdentities(1,2,new Set()),false);
});

test('partial feed success and missing artifacts stay degraded, not green',()=>{
 const make=(competition:string,ok:boolean):ImportHealth=>({source:'flashscore',competition,startedAt:'2026-10-21T17:00:00Z',finishedAt:'2026-10-21T17:01:00Z',...summarizeImport(ok?'Standings scraped: 8':'Empty standings',ok?0:1,false,'standings')});
 const summary=aggregateImportHealth([make('sra',false),make('urc',true)],['sra','urc','missing']);
 assert.equal(summary.status,'degraded');assert.deepEqual(summary.failed,['sra']);assert.deepEqual(summary.missing,['missing']);assert.equal(summary.completeSourceValidation,false);
 assert.equal(aggregateImportHealth([],[]).status,'failed');
 assert.equal(summarizeImport('Source HTTP 403',1).failureKind,'access_restricted');
});

const source=fs.readFileSync('tests/fixtures/top14-j7.html','utf8');
const activeTime=Date.parse('2026-10-24T13:00:00Z');
function memoryBucket(initial:Record<string,unknown>={}){
 const values=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
 return {values,put:async(k:string,v:string)=>{values.set(k,v);},get:async(k:string)=>values.has(k)?{json:async()=>JSON.parse(values.get(k)!)}:null};
}
test('monitor retries a temporary outage, reports the real read and stays shadow',async()=>{
 const bucket=memoryBucket();let calls=0;const pauses:number[]=[];
 const report=await runLnrLiveMonitor(bucket,activeTime,(async()=>++calls===1?new Response('',{status:503}):new Response(source)) as typeof fetch,async ms=>{pauses.push(ms);});
 assert.equal(calls,2);assert.deepEqual(pauses,[1000]);assert.equal(report.status,'observed');
 assert.equal(report.sources[0].attempts,2);assert.equal(report.sources[0].unmappedMatches,7);
 assert.equal(report.databaseWrites,0);assert.equal(report.sourceToDatabaseLatencyMs,null);assert.equal(report.writesResults,false);
});
test('restricted or stale sources preserve the last valid observation and do not fabricate freshness',async()=>{
 const key='rugbynow-monitor/fr-top14.json';
 const old=parseLnrLiveObservation(source,'fr-top14','2026-10-21T18:00:00Z');
 for(const response of [()=>new Response('',{status:403}),()=>new Response(source,{headers:{Age:'150'}})]){
  const bucket=memoryBucket({[key]:old});let calls=0;
  const report=await runLnrLiveMonitor(bucket,activeTime,(async()=>{calls++;return response();}) as typeof fetch,async()=>{});
  assert.equal(calls,1);assert.equal(report.status,'failed');assert.deepEqual(JSON.parse(bucket.values.get(key)!),old);
  assert.equal(report.sources[0].retainedPrevious,true);assert.equal(report.sources[0].observedAt,null);assert.equal(report.sources[0].lastValidObservedAt,old.observedAt);
 }
});
test('observation comparison preserves identity and counts score corrections without inventing states',()=>{
 const old=parseLnrLiveObservation(source.replace('"status":"not-started"','"status":"live"'),'fr-top14','2026-10-21T18:00:00Z');
 const next=structuredClone(old);next.matches[0].homeScore=7;
 assert.equal(compareLnrObservations(old,next).changedMatches,1);
 assert.equal(compareLnrObservations(next,old).changedMatches,1); // a lower score is still an observed change
 next.matches[0].homeSlug='wrong-club';assert.throws(()=>compareLnrObservations(old,next),/identity changed/);
 const final=structuredClone(old);final.matches[0].status='FT';assert.throws(()=>compareLnrObservations(final,old),/final regressed/);
 const now=Date.parse('2026-10-21T18:00:00Z');
 assert.equal(isMonitorDelayed({finishedAt:'invalid'},now),true);assert.equal(isMonitorDelayed(null,now),true);
 assert.equal(isMonitorDelayed({finishedAt:'2026-10-21T17:56:00Z'},now),true);
 assert.equal(isMonitorDelayed({finishedAt:'2026-10-21T18:00:00Z'},now),false);
});
