import fs from "node:fs";
import {isAgendaDate} from "../lib/dailyAgenda";
import {readRugbyApi,normalizeApiGame,type RugbyApiGame} from "../lib/apiSportsRugby";
async function main(){
 const key=process.env.API_SPORTS_KEY||"";if(!key)throw Error("API_SPORTS_KEY missing. No requests or database writes were made.");
 const date=process.env.RUGBY_API_DATE;
 if(date&&!isAgendaDate(date))throw Error("RUGBY_API_DATE must be a valid YYYY-MM-DD date");
 const leagues=await readRugbyApi<unknown>("leagues",{},key);
 const games=date?(await readRugbyApi<RugbyApiGame>("games",{date,timezone:"UTC"},key)).map(normalizeApiGame):[];
 if(!leagues.length)throw Error("Provider returned an empty league catalogue");
 fs.mkdirSync("logs/provider-validation",{recursive:true});
 fs.writeFileSync("logs/provider-validation/api-sports.json",JSON.stringify({checkedAt:new Date().toISOString(),mode:"read-only",date:date||null,leagues,games},null,2)+"\n");
 console.log(`Validated ${leagues.length} league entries and ${games.length} games. No database writes; review provider IDs and season mappings before activation.`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Provider validation failed");process.exitCode=1;});
