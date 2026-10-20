import assert from "node:assert/strict";
import test from "node:test";
import {getSnapshotLeagueData} from "../lib/supabaseSnapshot";
test("the competition calendar keeps October fixtures separate from reused June round numbers",()=>{
 const league=getSnapshotLeagueData("ar-urba-top14","2026-10-17",null,true);
 assert.ok(league);
 assert.ok(league.matches.some(m=>m.match_date==="2026-06-27"));
 const october=league.matches.filter(m=>m.match_date==="2026-10-17");
 assert.equal(october.length,7);
 const alumni=october.find(m=>m.id===15883);assert.ok(alumni);
 assert.equal(alumni.home_score,14);assert.equal(alumni.away_score,22);
 assert.ok(october.every(m=>m.match_date!=="2026-06-27"));
});
