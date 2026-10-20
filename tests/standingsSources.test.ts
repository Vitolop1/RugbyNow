import assert from "node:assert/strict";
import test from "node:test";
import {parseUrbaStandings,type OfficialTable} from "../lib/officialStandings";
import official from "../data/official-standings.json";
import {withOfficialStandings} from "../lib/standingsOverlay";
import {validateSourceStandings} from "../lib/sourceStandings";
test("official URBA overlay preserves actual points, bonus and existing recent form only in the correct edition",()=>{
 const payload={competition:{slug:"ar-urba-top14"},season:{name:"2026"},standings:[{teamId:1,teamSlug:"newman",form:["D","W","W","W","W"]}],standingsSource:"computed"};
 const result=withOfficialStandings(payload);assert.equal(result.standingsSource,"official");const row=result.standings[0] as unknown as {pts:number;pj:number;bo:number;form:string[]};assert.equal(row.pts,110);assert.equal(row.pj,26);assert.equal(row.bo,12);assert.deepEqual(row.form,["D","W","W","W","W"]);
 assert.equal(withOfficialStandings({...payload,season:{name:"2025"}}).standingsSource,"unavailable");
});
test("official parser refuses truncated data, unmapped teams and absent edition dates",()=>{
 assert.throws(()=>parseUrbaStandings("<html>empty</html>"));
 const rows=(official.tables[0] as OfficialTable).rows.map(r=>({position:r.position,teamName:r.team,played:r.pj,won:r.w,tied:r.d,lost:r.l,pointsFavor:r.pf,pointsAgainst:r.pa,pointsTotal:r.pts,bonusOffensive:r.bo,bonusDefensive:r.bd}));
 const html=(data:unknown)=>`<script>self.__next_f.push(${JSON.stringify([1,JSON.stringify({tournaments:[{label:"TOP 14 - Superior"}],playdate:"17 de oct de 2026",standings:data})])})</script>`;
 assert.equal(parseUrbaStandings(html(rows)).rows.length,14);
 assert.throws(()=>parseUrbaStandings(html(rows.slice(0,13))));
 assert.throws(()=>parseUrbaStandings(html([{...rows[0],teamName:"Newman Reserves"},...rows.slice(1)])));
});
test("a standings import cannot replace a valid table with null stats or duplicate ranks",()=>{
 const a={pos:1,team:"A",played:2,won:1,drawn:0,lost:1,pointsFor:30,pointsAgainst:20,points:5};const b={...a,pos:2,team:"B"};
 validateSourceStandings([a,b]);assert.throws(()=>validateSourceStandings([a,{...b,points:null}]));assert.throws(()=>validateSourceStandings([a,{...b,pos:1}]));assert.throws(()=>validateSourceStandings([a,{...b,won:2}]));
});
