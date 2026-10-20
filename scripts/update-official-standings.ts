import {parseEpcrStandings} from "../lib/epcrStandings";
import fs from "node:fs";
import {parseUrbaStandings,parseProD2Standings,parseTop14Standings,type OfficialTable} from "../lib/officialStandings";
async function main(){
 const file="data/official-standings.json";
 const tables=(JSON.parse(fs.readFileSync(file,"utf8")).tables||[]) as OfficialTable[];
 let failed=false;
 for(const [url,parse] of [["https://urba.org.ar/",parseUrbaStandings],["https://prod2.lnr.fr/classement",parseProD2Standings],["https://top14.lnr.fr/classement",parseTop14Standings],["https://www.epcrugby.com/champions-cup/matches/pool-tables",(html:string)=>parseEpcrStandings(html,"champions-cup")],["https://www.epcrugby.com/challenge-cup/matches/pool-tables",(html:string)=>parseEpcrStandings(html,"challenge-cup")]] as const){
  let table:OfficialTable|undefined;
  for(let attempt=0;attempt<2;attempt++){
   try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`HTTP ${response.status}`);table=parse(await response.text());break;}
   catch(error){console.error(`${url}: ${error instanceof Error?error.message:"Source failed"}`);}
  }
  if(!table){failed=true;continue;}
  const index=tables.findIndex(t=>t.competitionSlug===table!.competitionSlug&&t.season===table!.season);
  if(index<0)tables.push(table);else tables[index]=table;
  console.log(`${table.competitionSlug} ${table.season}: ${table.rows.length} official rows, round ${table.roundDate}.`);
 }
 fs.writeFileSync(file+".tmp",JSON.stringify({tables},null,2)+"\n");fs.renameSync(file+".tmp",file);
 if(failed)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Official table failed");process.exitCode=1;});
