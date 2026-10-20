export type OfficialStanding={position:number;team:string;slug:string;pj:number;w:number;d:number;l:number;pf:number;pa:number;pts:number;bo:number;bd:number};
export type OfficialTable={competitionSlug:string;season:string;sourceUrl:string;checkedAt:string;roundDate:string;rows:OfficialStanding[]};
const names:Record<string,string>={"Newman":"newman","CASI":"casi","Alumni":"alumni","SIC":"sic","Hindu":"hindu","Hindú":"hindu","Belgrano Athletic":"belgrano","Regatas Bella Vista":"regatas-bella-vista","Buenos Aires C&RC":"buenos-aires","La Plata":"la-plata","CUBA":"cuba","Los Tilos":"los-tilos","Los Matreros":"los-matreros","Atletico del Rosario":"atletico-del-rosario","Atlético del Rosario":"atletico-del-rosario","Champagnat":"champagnat"};
function jsonArrayAfter(text:string,key:string):unknown[]{
 const marker=`"${key}":[`;const start=text.indexOf(marker)+marker.length-1;if(start<marker.length-1)throw Error(`Missing ${key}`);
 let depth=0,quoted=false,escape=false;
 for(let i=start;i<text.length;i++){const char=text[i];if(quoted){if(escape)escape=false;else if(char==="\\")escape=true;else if(char==='"')quoted=false;continue;}if(char==='"')quoted=true;else if(char==='[')depth++;else if(char===']'&&--depth===0)return JSON.parse(text.slice(start,i+1));}
 throw Error("Truncated official table");
}
export function parseUrbaStandings(html:string,checkedAt=new Date().toISOString()):OfficialTable{
 if(html.length>2_000_000)throw Error("Source too large");
 const chunks:string[]=[];
 for(const match of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g)){const value=JSON.parse(match[1]);if(typeof value[1]==="string")chunks.push(value[1]);}
 const text=chunks.join("");if(!text.includes('"label":"TOP 14 - Superior"'))throw Error("URBA competition not identified");
 const sourceDates=[...text.matchAll(/"playdate":"(\d{1,2}) de (\w+) de (20\d{2})"/g)];
 const months=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
 const dates=sourceDates.flatMap(m=>{const month=months.indexOf(m[2]);return month<0?[]:[`${m[3]}-${String(month+1).padStart(2,"0")}-${m[1].padStart(2,"0")}`];}).sort();
 const roundDate=dates.at(-1);if(!roundDate)throw Error("Official edition date missing");
 const raw=jsonArrayAfter(text,"standings") as Record<string,unknown>[];
 const rows=raw.map((r):OfficialStanding=>{
  const slug=names[String(r.teamName)];if(!slug)throw Error(`Unmapped official team: ${String(r.teamName)}`);
  const keys=["position","played","won","tied","lost","pointsFavor","pointsAgainst","pointsTotal","bonusOffensive","bonusDefensive"];
  if(keys.some(k=>!Number.isInteger(r[k])||Number(r[k])<0))throw Error("Invalid official standings numbers");
  const row={position:Number(r.position),team:String(r.teamName),slug,pj:Number(r.played),w:Number(r.won),d:Number(r.tied),l:Number(r.lost),pf:Number(r.pointsFavor),pa:Number(r.pointsAgainst),pts:Number(r.pointsTotal),bo:Number(r.bonusOffensive),bd:Number(r.bonusDefensive)};
  if(row.pj!==row.w+row.d+row.l)throw Error("Official played total inconsistent");return row;
 });
 if(rows.length!==14||new Set(rows.map(r=>r.slug)).size!==14||new Set(rows.map(r=>r.position)).size!==14)throw Error("Incomplete official URBA table");
 return {competitionSlug:"ar-urba-top14",season:roundDate.slice(0,4),sourceUrl:"https://urba.org.ar/",checkedAt,roundDate,rows:rows.sort((a,b)=>a.position-b.position)};
}
