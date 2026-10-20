import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {summarizeImport,type ImportHealth} from "../lib/providerPolicy";

// One failed competition must not prevent the remaining feeds from running.
// Writes are idempotent in the importer; failures are reported, not blindly retried.
async function main(){
 const feeds=[...new Set((process.env.FLASH_URLS||"").split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean))];
 if(!feeds.length)throw Error("No competition feeds configured");
 const reportDir=process.env.IMPORT_HEALTH_DIR||"logs/import-health";fs.mkdirSync(reportDir,{recursive:true});
 let failed=0;
 for(const feed of feeds){
  const split=feed.indexOf("=");const competition=split>0?feed.slice(0,split):new URL(feed).pathname.replace(/[^a-z0-9]+/gi,"-");
  const startedAt=new Date().toISOString();let output="";
  const exitCode=await new Promise<number|null>((resolve,reject)=>{
   const child=spawn(process.execPath,[path.resolve("node_modules/tsx/dist/cli.mjs"),"scripts/sync-flashscore.ts"],{env:{...process.env,FLASH_URLS:feed,MATCHES_ONLY:process.env.STANDINGS_ONLY==="1"?"0":"1"},stdio:["ignore","pipe","pipe"]});
   child.stdout.on("data",chunk=>{const value=String(chunk);output=(output+value).slice(-2_000_000);process.stdout.write(value);});child.stderr.on("data",chunk=>process.stderr.write(chunk));
   child.once("error",reject);child.once("close",resolve);
  });
  const report:ImportHealth={source:"flashscore",competition,startedAt,finishedAt:new Date().toISOString(),...summarizeImport(output,exitCode,process.env.DRY_RUN==="1",process.env.STANDINGS_ONLY==="1"?"standings":"matches")};
  const target=path.join(reportDir,`${competition.replace(/[^a-z0-9_-]/gi,"-")}.json`);fs.writeFileSync(`${target}.tmp`,JSON.stringify(report,null,2)+"\n");fs.renameSync(`${target}.tmp`,target);
  console.log(`Feed ${competition}: ${report.ok?"OK":"FAILED"}, ${report.rows} source rows`);if(!report.ok)failed++;
 }
 if(failed)throw Error(`${failed}/${feeds.length} feeds failed. Successful feeds were preserved; see per-source health reports.`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Import failed");process.exitCode=1;});
