import fs from "node:fs";
import {getProD2Team} from "../lib/proD2";
import {parseLnrSquad,type TeamSquad} from "../lib/squads";
async function main(){
 const file="data/team-squads.json";
 const previous:TeamSquad[]=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")).squads:[];
 const r=await fetch("https://prod2.lnr.fr/classement",{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`LNR HTTP ${r.status}`);
 const html=await r.text();const clubs=new Map<string,string>();
 for(const link of html.matchAll(/href="(https:\/\/prod2\.lnr\.fr\/club\/[^"/]+)" class="base-link base-link--black">\s*([^<]+)<\/a>/g)){
  const team=getProD2Team(link[2]);if(!team)throw Error(`Unknown LNR club ${link[2]}`);clubs.set(team.slug,`${link[1]}/effectif-staff`);
 }
 if(clubs.size!==16)throw Error("Incomplete official club list");
 const squads=[...previous];const queue=[...clubs];let cursor=0,failures=0;
 await Promise.all(Array.from({length:3},async()=>{while(cursor<queue.length){const [slug,url]=queue[cursor++];let squad:TeamSquad|undefined;
  for(let attempt=0;attempt<2;attempt++){try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`HTTP ${response.status}`);squad=parseLnrSquad(await response.text(),slug,url);break;}catch(error){console.error(`${slug}: ${error instanceof Error?error.message:"Failed"}`);}}
  if(!squad){failures++;continue;}const index=squads.findIndex(s=>s.teamSlug===slug&&s.kind==="club-directory");if(index<0)squads.push(squad);else squads[index]=squad;
  console.log(`${slug}: ${squad.players.length} sourced players; edition not labeled by source.`);
 }}));
 if(!squads.length)throw Error("No valid directories; preserving previous file");
 fs.writeFileSync(file+".tmp",JSON.stringify({squads},null,2)+"\n");fs.renameSync(file+".tmp",file);if(failures)process.exitCode=1;
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Squad update failed");process.exitCode=1;});
