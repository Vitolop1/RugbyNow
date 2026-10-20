type SourceStanding={pos:number|null;team:string;played:number|null;won:number|null;drawn:number|null;lost:number|null;pointsFor:number|null;pointsAgainst:number|null;points:number|null};
// Validate the resolved write payload as well as the source rows: a failed team
// lookup or two aliases resolving to one ID must not publish a partial table.
export function validateResolvedStandingsTeamIds(teamIds: readonly (number | null)[], expectedCount: number) {
 if(teamIds.length !== expectedCount) throw Error(`Expected ${expectedCount} resolved standings teams, received ${teamIds.length}`);
 if(teamIds.some(id => id == null || !Number.isSafeInteger(id) || id <= 0)) throw Error("Standings contains an unresolved team ID");
 if(new Set(teamIds).size !== expectedCount) throw Error("Standings contains duplicate resolved team IDs");
}
export function validateSourceStandings(rows:SourceStanding[],expectedCount?:number){
 if(expectedCount != null && rows.length !== expectedCount) throw Error(`Expected ${expectedCount} standings teams, received ${rows.length}`);
 if(rows.length<2)throw Error("Standings table is empty or incomplete");
 const names=new Set<string>(),positions=new Set<number>();
 for(const row of rows){const name=row.team.trim().toLowerCase();if(!name||names.has(name))throw Error("Duplicate standings team");names.add(name);
  if(!Number.isInteger(row.pos)||row.pos!<1||positions.has(row.pos!))throw Error("Invalid or repeated table position");positions.add(row.pos!);
  const stats=[row.played,row.won,row.drawn,row.lost,row.pointsFor,row.pointsAgainst];
  if(stats.some(v=>v===null||!Number.isInteger(v)||v<0)||row.points===null||!Number.isInteger(row.points))throw Error("Missing standings statistics");
  if(row.played!==row.won!+row.drawn!+row.lost!)throw Error("Played total does not match wins, draws and losses");
 }
 if([...positions].some(position=>position>rows.length))throw Error("Standings positions contain gaps");
}

export const EXPECTED_TABLE_TEAMS:Record<string,number>={
 "ar-urba-top14:2026":14,"fr-pro-d2:2026/2027":16,"fr-top14:2026/2027":14,
 "en-premiership-rugby:2026/2027":10,"int-six-nations:2027":6,
 "int-united-rugby-championship:2026/2027":16,"it-serie-a-elite:2026/2027":10,"sra:2026":8,"us-mlr:2026":6,
};
type CachedRow={team_id:number|null;position:number|null;played:number|null;won:number|null;drawn:number|null;lost:number|null;points_for:number|null;points_against:number|null;points:number|null};
export function usableCachedStandings(rows:CachedRow[],teams:ReadonlyMap<number,{name:string}>,slug:string,season:string){
 try{
  validateResolvedStandingsTeamIds(rows.map(r=>r.team_id),EXPECTED_TABLE_TEAMS[`${slug}:${season}`]??rows.length);
  validateSourceStandings(rows.map(r=>({pos:r.position,team:teams.get(r.team_id!)?.name??"",played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,pointsFor:r.points_for,pointsAgainst:r.points_against,points:r.points})),EXPECTED_TABLE_TEAMS[`${slug}:${season}`]);
  return true;
 }catch{return false;}
}

export function requireStandingsEdition(sourceEdition:string,targetEdition:string){
 const canonical=(value:string)=>value.trim().replace(/\s/g,"").replace(/-/g,"/");
 if(!/^20\d{2}(?:\/20\d{2})?$/.test(canonical(sourceEdition))||canonical(sourceEdition)!==canonical(targetEdition))throw Error(`Standings edition mismatch: ${sourceEdition} versus ${targetEdition}`);
}
