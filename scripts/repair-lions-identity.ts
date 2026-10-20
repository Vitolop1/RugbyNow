import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { readAllRows } from "../lib/readAllRows";
loadEnvConfig(process.cwd());

// One bounded repair for the proven Lions / Old Lions substring collision.
// Default is read-only. Apply requires an explicit local backup destination.
async function main(){
  const apply=process.argv.includes("--apply");
  const backupPath=process.env.REPAIR_BACKUP_PATH;
  if(apply&&!backupPath)throw new Error("REPAIR_BACKUP_PATH is required for --apply");
  const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  const [{data:teams,error:teamError},{data:competitions,error:compError}]=await Promise.all([
    db.from("teams").select("id,name,slug"),db.from("competitions").select("id,slug").in("slug",["int-united-rugby-championship","eu-champions-cup","eu-challenge-cup"])
  ]);
  if(teamError||compError)throw new Error(teamError?.message || compError?.message);
  const old=teams?.find(team=>team.slug==="old-lions-rc");
  if(!old||!competitions?.length)throw new Error("Expected identities or competitions are missing");
  const {data:seasons,error:seasonError}=await db.from("seasons").select("id,competition_id,name").in("competition_id",competitions.map(comp=>comp.id));
  if(seasonError||!seasons?.length)throw new Error(seasonError?.message || "No target seasons");
  const seasonIds=seasons.map(season=>season.id);
  const matches=await readAllRows<Record<string,unknown>>((offset,size)=>db.from("matches").select("*").in("season_id",seasonIds).or(`home_team_id.eq.${old.id},away_team_id.eq.${old.id}`).order("id").range(offset,offset+size-1));
  const {data:standings,error:standingError}=await db.from("standings_cache").select("*").in("season_id",seasonIds).eq("team_id",old.id);
  if(standingError)throw new Error(standingError.message);
  const withoutSource=matches.filter(match=>!/^https:\/\/(?:www\.)?flashscore\.(?:com|es)\//.test(String(match.source_url || "")));
  if(withoutSource.length){
    console.log(JSON.stringify({withoutSource:withoutSource.map(match=>({id:match.id,season_id:match.season_id,source_url:match.source_url}))}));
    if(apply)throw new Error("A candidate lacks expected source provenance; inspect before applying");
  }
  const existing=teams?.find(team=>team.slug==="lions");
  console.log(JSON.stringify({mode:apply?"apply":"dry-run",oldTeamId:old.id,targetTeam:existing || {name:"Lions",slug:"lions"},matches:matches.length,standings:standings?.length || 0,matchIds:matches.map(match=>match.id)}));
  if(!apply || (!matches.length&&!standings?.length))return;
  fs.writeFileSync(backupPath!,JSON.stringify({createdAt:new Date().toISOString(),oldTeam:old,targetTeam:existing || null,seasons,matches,standings},null,2),{encoding:"utf8",flag:"wx"});
  let targetId=existing?.id;
  if(!targetId){
    const {data:created,error}=await db.from("teams").upsert({name:"Lions",slug:"lions"},{onConflict:"slug"}).select("id").single();
    if(error||!created)throw new Error(error?.message || "Could not create Lions");
    targetId=created.id;
  }
  for(const match of matches){
    const patch:Record<string,unknown>={};
    if(match.home_team_id===old.id)patch.home_team_id=targetId;
    if(match.away_team_id===old.id)patch.away_team_id=targetId;
    const {error}=await db.from("matches").update(patch).eq("id",match.id).eq("season_id",match.season_id);
    if(error)throw new Error(error.message);
  }
  if(standings?.length){
    const {error}=await db.from("standings_cache").update({team_id:targetId}).in("season_id",seasonIds).eq("team_id",old.id);
    if(error)throw new Error(error.message);
  }
  console.log(`Reassigned ${matches.length} matches and ${standings?.length || 0} standings to Lions (${targetId}); Old Lions RC preserved.`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
