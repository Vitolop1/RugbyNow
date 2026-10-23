import test from "node:test";
import assert from "node:assert/strict";
import {readFlashscoreRowStatus} from "../lib/flashscoreRowStatus";
import {detectStatusAndMinute} from "../lib/sourceMatchStatus";
import {renderToStaticMarkup} from "react-dom/server";
import React from "react";
import LiveStatusBadge from "../app/components/LiveStatusBadge";

// Source DOM observed on 23 October: stage/clock moved to event__stageTime.
// No previous .event__stage, .event__time or .event__status exists on live rows.
function row(fields:Record<string,string>):Pick<Element,"querySelector">{
 return {querySelector(selector:string){return fields[selector]===undefined?null:{textContent:fields[selector],innerText:fields[selector]};}} as unknown as Pick<Element,"querySelector">;
}
test("current stageTime DOM preserves source-live score and minute, including 0–0",()=>{
 for(const [text,h,a,status,minute] of [["2nd Half63",24,26,"LIVE",63],["2nd Half44",14,17,"LIVE",44],["1st Half0",0,0,"LIVE",null],["Half Time",8,16,"HT",null]] as const){
  const raw=readFlashscoreRowStatus(row({".event__stageTime":text,'[data-testid="wcl-stageTime"]':text}));
  assert.equal(raw,text);assert.deepEqual(detectStatusAndMinute(raw,h,a,"live"),{status,minute});
 }
});
test("semantic stageTime fallback, legacy state, scheduled time and empty status remain distinct",()=>{
 assert.equal(detectStatusAndMinute(readFlashscoreRowStatus(row({'[data-testid="wcl-stageTime"]':"Half Time"})),0,0,"live").status,"HT");
 assert.equal(detectStatusAndMinute(readFlashscoreRowStatus(row({".event__stage":"FT"})),24,23,"results").status,"FT");
 assert.equal(detectStatusAndMinute(readFlashscoreRowStatus(row({".event__time":"19:00"})),null,null,"live").status,"NS");
 assert.equal(detectStatusAndMinute(readFlashscoreRowStatus(row({})),24,26,"live").status,"NS");
 // The function must also execute alone inside the scraper's page evaluation.
 const serialized=Function(`return (${readFlashscoreRowStatus.toString()})`)();
 assert.equal(serialized(row({".event__stageTime":"2nd Half63"})),"2nd Half63");
});
test("red badge requires confirmed state and retains translated text",()=>{
 for(const state of ["NS","FT","CANC","pending","suspended","unknown"])assert.equal(renderToStaticMarkup(React.createElement(LiveStatusBadge,{state,label:"Live"})),"");
 for(const label of ["En juego 63′","Live 63′","En direct 63′","In diretta 63′"]){
  const html=renderToStaticMarkup(React.createElement(LiveStatusBadge,{state:"LIVE",label}));
  assert.ok(html.includes('data-live-status="LIVE"'));assert.ok(html.includes(label));
 }
 assert.ok(renderToStaticMarkup(React.createElement(LiveStatusBadge,{state:"HT",label:"Entretiempo"})).includes("Entretiempo"));
});
