import fs from 'node:fs';
import squads from '../data/team-squads.json';
import {parseLnrClubInformation, type ClubInformation} from '../lib/clubInformation';

async function main() {
  const file='data/club-information.json';
  const previous: ClubInformation[]=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).clubs:[];
  const clubs=[...previous]; let cursor=0, failures=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(cursor<squads.squads.length){
      const squad=squads.squads[cursor++];
      const url=squad.sourceUrl.replace(/\/effectif-staff$/, '/informations');
      let info:ClubInformation|undefined;
      for(let attempt=0;attempt<2;attempt++)try{
        const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        info=parseLnrClubInformation(await response.text(),squad.teamSlug,url);break;
      }catch(error){console.error(`${squad.teamSlug}: ${error instanceof Error?error.message:'Source failed'}`);}
      if(!info){failures++;continue;}
      const index=clubs.findIndex(c=>c.teamSlug===squad.teamSlug);
      if(index<0)clubs.push(info);else clubs[index]=info;
      console.log(`${squad.teamSlug}: ${info.stadium}`);
    }
  }));
  if(!clubs.length)throw Error('No valid information; previous file preserved');
  fs.writeFileSync(file+'.tmp',JSON.stringify({clubs},null,2)+'\n');fs.renameSync(file+'.tmp',file);
  if(failures)process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Club information failed');process.exitCode=1;});
