import assert from "node:assert/strict";
import test from "node:test";
import {isLiveRefreshCandidate,isLiveDataDelayed} from "../lib/liveRefresh";
import {getMatchClockLabel} from "../lib/matchPresentation";
test("refresh selection includes imminent and source-live matches without inventing live states",()=>{
 const now=Date.parse("2026-10-17T18:30:00Z");const fixture={status:"NS",match_date:"2026-10-17",kickoff_time:"18:35:00"};assert.equal(isLiveRefreshCandidate(fixture,now),true);assert.equal(fixture.status,"NS");assert.equal(isLiveRefreshCandidate({...fixture,status:"CANC"},now),false);assert.equal(isLiveRefreshCandidate({...fixture,kickoff_time:"10:00:00"},now),false);
 assert.equal(isLiveDataDelayed("LIVE","2026-10-17T18:20:00Z",now),true);assert.equal(isLiveDataDelayed("FT",null,now),false);
});
test("the live minute remains the last source minute rather than advancing from an old scrape",()=>{
 const label=getMatchClockLabel({status:"LIVE",minute:23,updatedAt:"2026-10-17T18:00:00Z",matchDate:"2026-10-17",kickoffTime:"17:30:00",timeZone:"UTC",lang:"en"});assert.ok(label.includes("23'"));assert.ok(!label.includes("40"));
});
