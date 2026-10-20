import fs from "node:fs";
import {parseUrbaStandings} from "../lib/officialStandings";
async function main(){const response=await fetch("https://urba.org.ar/",{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`URBA HTTP ${response.status}`);const table=parseUrbaStandings(await response.text());fs.writeFileSync("data/official-standings.json",JSON.stringify({tables:[table]},null,2)+"\n");console.log(`URBA ${table.season}: ${table.rows.length} official rows, source round ${table.roundDate}. No database results changed.`);}
main().catch(error=>{console.error(error instanceof Error?error.message:"Official table failed");process.exitCode=1;});
