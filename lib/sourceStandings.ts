type SourceStanding={pos:number|null;team:string;played:number|null;won:number|null;drawn:number|null;lost:number|null;pointsFor:number|null;pointsAgainst:number|null;points:number|null};
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
}
