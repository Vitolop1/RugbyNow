import assert from "node:assert/strict";
import test from "node:test";
import { EDITORIAL_AGENDA } from "../data/rugbyAgenda";
import { buildDailyEntries, dailyEntryDate, dailyEntryState, isAgendaDate, type AgendaMatchRow } from "../lib/dailyAgenda";
import {getEffectiveMatchState} from "../lib/matchStatus";

const row:AgendaMatchRow={id:15883,match_date:"2026-10-17",kickoff_time:"18:30:00",status:"FT",minute:null,home_score:14,away_score:22,home_team:{name:"Alumni",slug:"alumni"},away_team:{name:"CASI",slug:"casi"},season:{competition:{name:"URBA Top 14",slug:"ar-urba-top14"}},updated_at:"2026-10-19T18:30:00Z"};

test("merge keeps the source score and a single URBA match with dated editorial TV",()=>{
  const entries=buildDailyEntries([row],EDITORIAL_AGENDA);
  const alumni=entries.filter(entry=>entry.home==="Alumni");
  assert.equal(alumni.length,1);assert.equal(alumni[0].homeScore,14);assert.equal(alumni[0].awayScore,22);
  assert.equal(alumni[0].startsAt,"2026-10-17T18:30:00.000Z");assert.equal(alumni[0].providers[0].id,"disney-plus");
  assert.equal(alumni[0].editorial?.sourceDate,"2026-10-15");
});
test("broadcast rights never propagate to other fixtures or editions",()=>{
  const entries=buildDailyEntries([{...row,match_date:"2026-10-24"}],EDITORIAL_AGENDA);
  assert.deepEqual(entries.find(entry=>entry.matchId===row.id)!.providers,[]);
});
test("editorial crests use exact clubs and preserve youth team names",()=>{
  const entries=buildDailyEntries([],EDITORIAL_AGENDA);
  const club=entries.find(entry=>entry.home==="Pueyrredón");
  assert.equal(club?.homeSlug,"pueyrredon");assert.equal(club?.awaySlug,"san-luis");
  const youth=entries.find(entry=>entry.home==="Hong Kong China M-19");
  assert.equal(youth?.homeSlug,"hong-kong");assert.equal(youth?.awaySlug,"namibia");
  assert.equal(entries.find(entry=>entry.home==="Universitario")?.homeSlug,undefined);
});
test("elapsed kickoff never creates a live state or a final score",()=>{
  const entry=buildDailyEntries([{...row,status:"NS",home_score:null,away_score:null}],[])[0];
  assert.equal(dailyEntryState(entry,Date.parse("2026-10-17T18:40:00Z")),"pending");
  assert.equal(entry.homeScore,null);assert.equal(entry.awayScore,null);
  assert.equal(dailyEntryState({...entry,status:"LIVE",minute:12},Date.parse("2026-10-17T18:40:00Z")),"LIVE");
  assert.deepEqual(getEffectiveMatchState("NS","2026-10-17","18:30:00",null,"ar-urba-top14",null,new Date("2026-10-17T18:40:00Z")),{status:"NS",minute:null});
  assert.deepEqual(getEffectiveMatchState("LIVE","2026-10-17","18:30:00",12,"ar-urba-top14",null,new Date("2026-10-17T19:15:00Z")),{status:"LIVE",minute:12});
});
test("timezone changes place late UTC matches on the correct local date",()=>{
  const entry=buildDailyEntries([{...row,kickoff_time:"00:30:00"}],[])[0];
  assert.equal(dailyEntryDate(entry,"America/Argentina/Buenos_Aires"),"2026-10-16");
  assert.equal(dailyEntryDate(entry,"Pacific/Auckland"),"2026-10-17");
  const unknown=buildDailyEntries([{...row,kickoff_time:null}],[])[0];
  assert.equal(unknown.startsAt,null);assert.equal(dailyEntryDate(unknown,"America/New_York"),row.match_date);
});
test("deduplication preserves distinct same-day games and picks the newer correction",()=>{
  const correction={...row,id:999,home_score:15,updated_at:"2026-10-19T19:30:00Z"};
  const later={...row,id:1000,kickoff_time:"23:30:00"};
  const entries=buildDailyEntries([row,correction,later],[]);
  assert.equal(entries.length,2);assert.equal(entries[0].homeScore,15);assert.equal(entries[1].matchId,1000);
});
test("impossible calendar dates are rejected rather than rolled into another month",()=>{
  assert.equal(isAgendaDate("2026-02-30"),false);assert.equal(isAgendaDate("2026-13-01"),false);
  assert.equal(isAgendaDate("2028-02-29"),true);assert.equal(isAgendaDate("2026-10-17"),true);
});
