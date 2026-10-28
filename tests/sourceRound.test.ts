import test from "node:test";
import assert from "node:assert/strict";
import {parseSourceRound} from "../lib/sourceRound";
import {getConfirmedMatchRound} from "../lib/matchBroadcasts";
import broadcasts from "../data/match-broadcasts.json";

test("round extraction never substitutes a kickoff date or a score",()=>{
  for(const text of ["22.10. 21:00 Montauban Oyonnax", "17.10.2026 14 26", "Pro D2 2026/2027", "Round of 16", "Quarter-finals"]){
    assert.equal(parseSourceRound("",text),null);
  }
  assert.equal(parseSourceRound("8"),8);
  assert.equal(parseSourceRound("Round 8"),8);
  assert.equal(parseSourceRound("", "France | Journée 8"),8);
  assert.equal(parseSourceRound("", "Fecha 12"),12);
});

test("official Pro D2 round requires the exact verified fixture and kickoff",()=>{
  // The nightly official source can replace the scheduled time with the exact
  // observed kickoff. Validate matching, not a stale hard-coded source time.
  const listing=broadcasts.listings.find(row=>row.id==="lnr-12068-fr")!;
  assert.ok(listing);
  const query={competitionSlug:"fr-pro-d2",home:"Montauban",away:"US Oyonnax",startsAt:listing.startsAt};
  assert.equal(getConfirmedMatchRound(query),8);
  assert.equal(getConfirmedMatchRound({...query,startsAt:"2026-10-23T19:00:00Z"}),null);
  assert.equal(getConfirmedMatchRound({...query,home:"Brive"}),null);
});
