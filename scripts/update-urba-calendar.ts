import fs from 'node:fs';
import {parseUrbaCalendar} from '../lib/urbaCalendar';
async function main(){
 let calendar:ReturnType<typeof parseUrbaCalendar>|undefined;
 for(let attempt=0;attempt<2;attempt++)try{
  const response=await fetch('https://urba.org.ar/api/fixture/championship/2025176',{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`URBA HTTP ${response.status}`);
  calendar=parseUrbaCalendar(await response.json());break;
 }catch(error){console.error(error instanceof Error?error.message:'URBA failed');}
 if(!calendar)throw Error('URBA calendar validation failed; previous file preserved');
 const file='data/urba-calendar.json';fs.writeFileSync(file+'.tmp',JSON.stringify(calendar,null,2)+'\n');fs.renameSync(file+'.tmp',file);
 console.log(`${calendar.fixtures.length} official fixtures; full results agree with the official W/D/L/PF/PA table`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'URBA failed');process.exitCode=1;});
