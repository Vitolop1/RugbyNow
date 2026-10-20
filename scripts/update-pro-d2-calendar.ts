import fs from "node:fs";
import {parseProD2CalendarRound,validateProD2Calendar,type OfficialProD2Fixture} from "../lib/proD2Calendar";
async function main(){
 const season="2026/2027",fixtures:OfficialProD2Fixture[]=[];let cursor=1;
 await Promise.all(Array.from({length:3},async()=>{while(cursor<=30){const round=cursor++;const url=`https://prod2.lnr.fr/calendrier-et-resultats/${season.replace("/","-")}/j${round}`;let rows:OfficialProD2Fixture[]|undefined;
  for(let attempt=0;attempt<2;attempt++){try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`HTTP ${response.status}`);rows=parseProD2CalendarRound(await response.text(),season,round);break;}catch(error){console.error(`J${round}: ${error instanceof Error?error.message:"Source failed"}`);}}
  if(!rows)throw Error(`J${round} failed; previous full calendar preserved`);fixtures.push(...rows);console.log(`J${round}: ${rows.length} fixtures, ${rows.filter(m=>m.date).length} confirmed dates`);
 }}));
 validateProD2Calendar(fixtures);fixtures.sort((a,b)=>a.round-b.round||a.sourceId-b.sourceId);
 const file="data/pro-d2-calendar.json";fs.writeFileSync(file+".tmp",JSON.stringify({sourceName:"LNR · Pro D2",sourceUrl:"https://prod2.lnr.fr/calendrier-et-resultats",season,checkedAt:new Date().toISOString(),fixtures},null,2)+"\n");fs.renameSync(file+".tmp",file);
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Calendar failed");process.exitCode=1;});
