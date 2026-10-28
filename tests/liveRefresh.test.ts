import {detectStatusAndMinute} from "../lib/sourceMatchStatus";
import assert from "node:assert/strict";
import test from "node:test";
import {isLiveRefreshCandidate,isLiveDataDelayed,liveSourceUrls,canRefreshLiveTarget,assessLiveCoverage,preferNewerReading} from "../lib/liveRefresh";
import {getMatchClockLabel} from "../lib/matchPresentation";
test("refresh selection includes imminent and source-live matches without inventing live states",()=>{
 const now=Date.parse("2026-10-17T18:30:00Z");const fixture={status:"NS",match_date:"2026-10-17",kickoff_time:"18:35:00"};assert.equal(isLiveRefreshCandidate(fixture,now),true);assert.equal(fixture.status,"NS");assert.equal(isLiveRefreshCandidate({...fixture,status:"CANC"},now),false);assert.equal(isLiveRefreshCandidate({...fixture,kickoff_time:"10:00:00"},now),false);
 assert.equal(isLiveDataDelayed("LIVE","2026-10-17T18:20:00Z",now),true);assert.equal(isLiveDataDelayed("FT",null,now),false);
});
test("the live minute remains the last source minute rather than advancing from an old scrape",()=>{
 const label=getMatchClockLabel({status:"LIVE",minute:23,updatedAt:"2026-10-17T18:00:00Z",matchDate:"2026-10-17",kickoffTime:"17:30:00",timeZone:"UTC",lang:"en"});assert.ok(label.includes("23'"));assert.ok(!label.includes("40"));
});

test("source clock accepts apostrophe, unicode minute marks, stoppage time and zero scores",()=>{
 assert.deepEqual(detectStatusAndMinute("23'",0,0,"live"),{status:"LIVE",minute:23});
 assert.deepEqual(detectStatusAndMinute("80+3′",21,21,"live"),{status:"LIVE",minute:83});
 assert.deepEqual(detectStatusAndMinute("HT",0,0,"live"),{status:"HT",minute:null});
 assert.deepEqual(detectStatusAndMinute("15:30",null,null,"fixtures"),{status:"NS",minute:null});
 assert.deepEqual(detectStatusAndMinute("FT",0,0,"live"),{status:"FT",minute:null});
});

test("live refresh reads finals without rewriting historical or unidentified fixtures",()=>{
 const now=Date.parse("2026-10-17T20:30:00Z");
 assert.deepEqual(liveSourceUrls("https://www.flashscore.com/rugby-union/france/pro-d2"),["https://www.flashscore.com/rugby-union/france/pro-d2/live","https://www.flashscore.com/rugby-union/france/pro-d2/results"]);
 const row={status:"LIVE",match_date:"2026-10-17",kickoff_time:"18:35:00"};
 assert.equal(canRefreshLiveTarget(row,now),true);
 assert.equal(canRefreshLiveTarget({...row,status:"NS"},now),true);
 assert.equal(canRefreshLiveTarget({...row,status:"FT"},now),false);
 assert.equal(canRefreshLiveTarget({...row,status:"NS",kickoff_time:null},now),false);
 assert.equal(canRefreshLiveTarget(null,now),false);
});

test("a successful process does not prove active fixtures were refreshed",()=>{
 const expected=[{id:1,status:"LIVE"},{id:2,status:"HT"},{id:3,status:"NS"}];
 const started="2026-10-17T18:30:00Z";
 assert.deepEqual(assessLiveCoverage(expected,[{id:1,updated_at:"2026-10-17T18:31:00Z"},{id:2,updated_at:"2026-10-17T18:20:00Z"}],started),{activeExpected:2,activeRefreshed:1,unverifiedMatchIds:[2]});
 assert.equal(assessLiveCoverage(expected,[{id:1,updated_at:"invalid"}],started).activeRefreshed,0);
});

test("started NS candidates cannot disappear behind a successful empty live pass",()=>{
 const started="2026-10-23T18:33:00Z";
 const expected=[{id:16914,status:"NS",match_date:"2026-10-23",kickoff_time:"17:00:00"},
  {id:16919,status:"NS",match_date:"2026-10-23",kickoff_time:"19:00:00"}];
 assert.deepEqual(assessLiveCoverage(expected,[],started),{activeExpected:1,activeRefreshed:0,unverifiedMatchIds:[16914]});
 assert.equal(assessLiveCoverage(expected,[{id:16914,updated_at:"2026-10-23T18:33:30Z"}],started).unverifiedMatchIds.length,0);
 assert.equal(expected[0].status,"NS");
});

test("source replay preserves zero scores, corrections and confirmed final without inventing a clock",()=>{
 const steps=[{text:"23'",h:0,a:0,status:"LIVE"},{text:"25'",h:7,a:0,status:"LIVE"},{text:"26'",h:5,a:0,status:"LIVE"},{text:"HT",h:5,a:0,status:"HT"},{text:"FT",h:19,a:12,status:"FT"}];
 for(const step of steps){const parsed=detectStatusAndMinute(step.text,step.h,step.a,"live");assert.equal(parsed.status,step.status);const label=getMatchClockLabel({status:parsed.status,minute:parsed.minute,matchDate:"2026-10-17",kickoffTime:"18:00:00",timeZone:"UTC",lang:"en"});if(parsed.minute!==null)assert.ok(label.includes(String(parsed.minute)));}
 assert.equal(isLiveDataDelayed("LIVE","2026-10-17T18:00:00Z",Date.parse("2026-10-17T18:04:00Z")),true);
});

test("an older response cannot rewind the score, but a newer correction can lower it",()=>{
 const current={status:"LIVE",score:7,updatedAt:"2026-10-17T18:25:00Z"};
 const timestamp=(row:typeof current)=>row.updatedAt;
 assert.equal(preferNewerReading(current,{...current,score:0,updatedAt:"2026-10-17T18:23:00Z"},timestamp),current);
 assert.equal(preferNewerReading(current,{...current,updatedAt:""},timestamp),current);
 assert.equal(preferNewerReading(current,{...current,score:5,updatedAt:"2026-10-17T18:26:00Z"},timestamp).score,5);
 const final={...current,status:"FT",updatedAt:"2026-10-17T20:00:00Z"};
 assert.equal(preferNewerReading(final,current,timestamp).status,"FT");
});
