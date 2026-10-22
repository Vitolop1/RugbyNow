import assert from "node:assert/strict";
import test from "node:test";
import {createInternationalBroadcastIndex, safeBroadcastHref, dailyBroadcastQuery, getInternationalMatchBroadcasts} from "../lib/internationalBroadcasts";
import type {ConfirmedMatchBroadcast} from "../lib/matchBroadcasts";
import {buildDailyEntries} from "../lib/dailyAgenda";
const listing: ConfirmedMatchBroadcast={id:"fixture-fr",competitionSlug:"fr-pro-d2",season:"2026-2027",home:"Montauban",away:"Oyonnax",startsAt:"2026-10-22T19:00:00Z",country:"FR",providerIds:["canal-plus-sport"],sourceName:"LNR",sourceUrl:"https://prod2.lnr.fr/feuille-de-match/2026-2027/j8/12068-montauban-oyonnax",checkedAt:"2026-10-20T12:00:00Z"};
const query={competitionSlug:listing.competitionSlug,home:listing.home,away:listing.away,startsAt:listing.startsAt,season:listing.season};
test("international TV groups only exact fixtures and preserves every territorial source",()=>{
 const lookup=createInternationalBroadcastIndex([listing,{...listing,id:"fixture-ar",country:"AR",providerIds:["disney-plus"]},{...listing,id:"fixture-gb",country:"GB"},listing]);
 const result=lookup(query);
 assert.equal(result.length,2);assert.deepEqual(result[0].countries,["FR","GB"]);assert.equal(result[0].evidence.length,2);
 assert.equal(result[1].evidence[0].country,"AR");assert.equal(result[1].evidence[0].checkedAt,listing.checkedAt);
 assert.equal(result[1].evidence[0].linkType,"platform");
 for(const change of [{home:"Montauban reserves"},{home:"Oyonnax",away:"Montauban"},{startsAt:"2026-10-23T19:00:00Z"},{competitionSlug:"fr-top14"},{season:"2025-2026"},{startsAt:null}]) assert.deepEqual(lookup({...query,...change}),[]);
 assert.equal(createInternationalBroadcastIndex([listing])(query).length,1);
 assert.deepEqual(createInternationalBroadcastIndex([])(query),[]);
});
test("invalid evidence, conflicting seasons and generic search links never acquire confirmation",()=>{
 for(const change of [{checkedAt:"invalid"},{sourceUrl:"https://google.com/search?q=rugby"},{country:""},{season:"2026-2029"}]) assert.deepEqual(createInternationalBroadcastIndex([{...listing,...change}])(query),[]);
 assert.deepEqual(createInternationalBroadcastIndex([listing,{...listing,season:"2025-2026"}])({...query,season:undefined}),[]);
 for(const href of ["javascript:alert(1)","https://user:secret@example.com/","https://www.youtube.com/results?search_query=rugby"]) assert.equal(safeBroadcastHref(href),undefined);
 assert.equal(safeBroadcastHref("https://www.youtube.com/@canal"),"https://www.youtube.com/@canal");
});
test("dated editorial guide retains Argentina, publication date and exact competition scope",()=>{
 const event={id:"guide",kind:"match" as const,title:"Lions vs Old Lions",competition:"Regional",region:"argentina" as const,startsAt:"2026-10-17T19:00:00Z",source:"Dated guide",sourceDate:"2026-10-15",transmissionPending:false,providers:[{id:"channel",name:"Channel",href:"https://example.com/channel",linkType:"channel" as const}]};
 const lookup=createInternationalBroadcastIndex([], [event]);const [entry]=buildDailyEntries([], [event]);
 assert.equal(lookup(dailyBroadcastQuery(entry))[0].evidence[0].dateKind,"published");
 assert.deepEqual(lookup(dailyBroadcastQuery(entry))[0].countries,["AR"]);
 assert.deepEqual(lookup({...dailyBroadcastQuery(entry),competitionSlug:"other"}),[]);
 assert.deepEqual(lookup({...dailyBroadcastQuery(entry),home:"Old Lions"}),[]);
 assert.deepEqual(createInternationalBroadcastIndex([],[{...event,transmissionPending:true}])(dailyBroadcastQuery(entry)),[]);
});
test("existing confirmed Pro D2 data is available regardless of viewer country",()=>{
 const result=getInternationalMatchBroadcasts(query);assert.equal(result[0].id,"canal-plus-sport");assert.deepEqual(result[0].countries,["FR"]);
});

test("agenda entries carry the actual edition for TV matching without changing scores or status",()=>{
 const row={id:1,match_date:"2026-10-22",kickoff_time:"19:00:00",status:"LIVE",minute:0,home_score:0,away_score:0,home_team:{name:"Montauban",slug:"montauban"},away_team:{name:"Oyonnax",slug:"oyonnax"},season:{name:"2026-2027",competition:{name:"Pro D2",slug:"fr-pro-d2"}}};
 const [entry]=buildDailyEntries([row],[]);assert.equal(entry.season,"2026-2027");assert.equal(entry.status,"LIVE");assert.equal(entry.minute,0);assert.equal(entry.homeScore,0);
 assert.equal(getInternationalMatchBroadcasts(dailyBroadcastQuery(entry)).length,1);
 assert.deepEqual(getInternationalMatchBroadcasts({...dailyBroadcastQuery(entry),season:"2025-2026"}),[]);
});
