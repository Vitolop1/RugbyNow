type Result={status:string;home_score:number|null;away_score:number|null};
export function leagueInsight(matches:Result[]){
  const finals=matches.filter(m=>m.status==='FT'&&Number.isInteger(m.home_score)&&Number.isInteger(m.away_score)&&m.home_score!>=0&&m.away_score!>=0);
  if(!finals.length)return null;
  const points=finals.reduce((sum,m)=>sum+m.home_score!+m.away_score!,0);
  return {played:finals.length,points,average:points/finals.length,draws:finals.filter(m=>m.home_score===m.away_score).length};
}
