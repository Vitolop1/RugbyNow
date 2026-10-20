import assert from "node:assert/strict";
import test from "node:test";
import {summarizeImport} from "../lib/providerPolicy";
import {normalizeApiGame,type RugbyApiGame} from "../lib/apiSportsRugby";
test("an empty successful process is not a successful feed",()=>{assert.equal(summarizeImport("DONE",0).ok,false);assert.equal(summarizeImport("Scraped rows total (deduped): 14",1).ok,false);assert.equal(summarizeImport("Scraped rows total (deduped): 14\nTOTAL updated matches: 10\nTOTAL inserted/upserted matches: 4",0).ok,true);});
const game:RugbyApiGame={id:23,date:"2026-10-17T15:30:00-03:00",status:{short:"NS"},league:{id:9,name:"Test",season:2026},teams:{home:{id:1,name:"Lions"},away:{id:2,name:"Old Lions"}},scores:{home:null,away:null}};
test("API identity is namespaced, timezone explicit, and past starts do not invent live states",()=>{const result=normalizeApiGame(game);assert.equal(result.sourceId,"api-sports:23");assert.equal(result.startsAt,"2026-10-17T18:30:00.000Z");assert.equal(result.status,"NS");assert.notEqual(result.homeId,result.awayId);assert.throws(()=>normalizeApiGame({...game,date:"2026-10-17T15:30:00"}));assert.throws(()=>normalizeApiGame({...game,status:{short:"UNKNOWN"}}));});
