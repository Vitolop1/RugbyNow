import {getProD2Team} from "./proD2";
import {validateSourceStandings} from "./sourceStandings";
export type OfficialStanding={position:number;team:string;slug:string;pj:number;w:number;d:number;l:number;pf:number|null;pa:number|null;pts:number;bo?:number;bd?:number;bonus?:number;group?:string;difference?:number;tries?:number};
export type OfficialTable={competitionSlug:string;season:string;sourceUrl:string;sourceName?:string;checkedAt:string;roundDate:string|null;phase?:string;rows:OfficialStanding[]};
export const urbaTeamSlugs:Record<string,string>={"Newman":"newman","CASI":"casi","Alumni":"alumni","SIC":"sic","Hindu":"hindu","Hindú":"hindu","Belgrano Athletic":"belgrano","Regatas Bella Vista":"regatas-bella-vista","Buenos Aires C&RC":"buenos-aires","La Plata":"la-plata","CUBA":"cuba","Los Tilos":"los-tilos","Los Matreros":"los-matreros","Atletico del Rosario":"atletico-del-rosario","Atlético del Rosario":"atletico-del-rosario","Champagnat":"champagnat"};
function jsonArrayAfter(text:string,key:string):unknown[]{
 const marker=`"${key}":[`;const start=text.indexOf(marker)+marker.length-1;if(start<marker.length-1)throw Error(`Missing ${key}`);
 let depth=0,quoted=false,escape=false;
 for(let i=start;i<text.length;i++){const char=text[i];if(quoted){if(escape)escape=false;else if(char==="\\")escape=true;else if(char==='"')quoted=false;continue;}if(char==='"')quoted=true;else if(char==='[')depth++;else if(char===']'&&--depth===0)return JSON.parse(text.slice(start,i+1));}
 throw Error("Truncated official table");
}

/** Read the full regular-season table, never the home/away or player rankings. */
function parseLnrStandings(html:string,checkedAt:string,config:{name:string;slug:string;expected:number;url:string;team:(name:string)=>{slug:string;officialName:string}|null}):OfficialTable {
 if(html.length>2_000_000)throw Error("Source too large");
 const edition=html.match(new RegExp(`<title>Classement ${config.name} (20\\d{2})-(20\\d{2}) \\| J(\\d+)`));
 if(!edition||Number(edition[2])!==Number(edition[1])+1||!html.includes('ranking__scrollable-cells'))throw Error("Official Pro D2 edition missing");
 const blocks=html.split('<div class="table-line table-line--ranking-full table-line--ranking-scrollable">').slice(1);
 const rows=blocks.map((block,index):OfficialStanding=>{
  const head=block.split('table-line__cell-wrapper--history')[0];
  const name=head.match(/class="base-link base-link--black">\s*([^<]+)<\/a>/)?.[1]?.trim();
  const team=name?config.team(name):null;if(!team)throw Error(`Unknown Pro D2 identity: ${name}`);
  const values=[...head.matchAll(/<div class="(?:table-line__cell--small)?">\s*([+-]?\d+)\s*<\/div>/g)].map(m=>Number(m[1]));
  if(values.length!==9)throw Error("Incomplete Pro D2 statistics");
  const [pts,pj,w,d,l,bonus,pf,pa,diff]=values;
  if(diff!==pf-pa||bonus<0)throw Error("Inconsistent Pro D2 statistics");
  return {position:index+1,team:team.officialName,slug:team.slug,pts,pj,w,d,l,bonus,pf,pa};
 });
 validateSourceStandings(rows.map(r=>({pos:r.position,team:r.slug,played:r.pj,won:r.w,drawn:r.d,lost:r.l,pointsFor:r.pf,pointsAgainst:r.pa,points:r.pts})),config.expected);
 if(rows.reduce((s,r)=>s+r.pf!-r.pa!,0)!==0)throw Error("Unbalanced full Pro D2 table");
 const dates=[...html.matchAll(/(\d{2})\\?\/(\d{2})\\?\/(20\d{2})/g)].map(m=>`${m[3]}-${m[2]}-${m[1]}`).filter(d=>d.slice(0,4)===edition[1]||d.slice(0,4)===edition[2]).sort();
 const roundDate=dates.at(-1);if(!roundDate)throw Error("Pro D2 source match date missing");
 return {competitionSlug:config.slug,season:`${edition[1]}/${edition[2]}`,sourceUrl:config.url,sourceName:`LNR · ${config.name}`,checkedAt,roundDate,phase:"regular",rows};
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
  const slug=urbaTeamSlugs[String(r.teamName)];if(!slug)throw Error(`Unmapped official team: ${String(r.teamName)}`);
  const keys=["position","played","won","tied","lost","pointsFavor","pointsAgainst","pointsTotal","bonusOffensive","bonusDefensive"];
  if(keys.some(k=>!Number.isInteger(r[k])||Number(r[k])<0))throw Error("Invalid official standings numbers");
  const row={position:Number(r.position),team:String(r.teamName),slug,pj:Number(r.played),w:Number(r.won),d:Number(r.tied),l:Number(r.lost),pf:Number(r.pointsFavor),pa:Number(r.pointsAgainst),pts:Number(r.pointsTotal),bo:Number(r.bonusOffensive),bd:Number(r.bonusDefensive)};
  if(row.pj!==row.w+row.d+row.l)throw Error("Official played total inconsistent");return row;
 });
 if(rows.length!==14||new Set(rows.map(r=>r.slug)).size!==14||new Set(rows.map(r=>r.position)).size!==14)throw Error("Incomplete official URBA table");
 return {competitionSlug:"ar-urba-top14",season:roundDate.slice(0,4),sourceUrl:"https://urba.org.ar/",checkedAt,roundDate,rows:rows.sort((a,b)=>a.position-b.position)};
}

export function parseProD2Standings(html:string,checkedAt=new Date().toISOString()){
 return parseLnrStandings(html,checkedAt,{name:"PRO D2",slug:"fr-pro-d2",expected:16,url:"https://prod2.lnr.fr/classement",team:getProD2Team});
}
export const top14Teams:Record<string,string>={"Stade Toulousain":"stade-toulousain","Section Paloise":"section-paloise","Union Bordeaux-Bègles":"bordeaux-begles","Stade Rochelais":"stade-rochelais","Aviron Bayonnais":"bayonne","Stade Français Paris":"stade-francais","Montpellier Hérault Rugby":"montpellier-herault-rugby","LOU Rugby":"lyon","USA Perpignan":"usa-perpignan","RC Toulon":"toulon","ASM Clermont":"asm-clermont-auvergne","Racing 92":"racing-92","Castres Olympique":"castres-olympique","RC Vannes":"vannes"};
export function parseTop14Standings(html:string,checkedAt=new Date().toISOString()){
 return parseLnrStandings(html,checkedAt,{name:"TOP 14",slug:"fr-top14",expected:14,url:"https://top14.lnr.fr/classement",team:name=>top14Teams[name]?{slug:top14Teams[name],officialName:name}:null});
}
