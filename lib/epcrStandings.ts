import type {OfficialStanding,OfficialTable} from "./officialStandings";
import snapshot from "../data/supabase-snapshot.json";
const aliases:Record<string,string>={"emirates-lions":"lions","dhl-stormers":"stormers","munster-rugby":"munster","gloucester-rugby":"gloucester","union-bordeaux-begles":"bordeaux-begles","bristol-bears":"bristol","vodacom-bulls":"bulls","bath-rugby":"bath","stade-francais-paris":"stade-francais","ulster-rugby":"ulster","dragons-rfc":"dragons","aviron-bayonnais":"bayonne","toyota-cheetahs":"cheetahs","usap":"usa-perpignan","zebre-parma":"zebre","hollywoodbets-sharks":"sharks","lyon-o-u":"lyon","benetton-rugby":"benetton","rc-toulon":"toulon","edinburgh-rugby":"edinburgh","rc-vannes":"vannes"};
function plain(value:string){return value.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&#39;|&#039;/g,"'").replace(/\s+/g," ").trim();}
export function parseEpcrStandings(html:string,competition:"champions-cup"|"challenge-cup",checkedAt=new Date().toISOString()):OfficialTable{
 if(html.length>2_000_000)throw Error("EPCR source too large");
 const season=html.match(/class="font-bold">(20\d{2}\/20\d{2})<\/span>/)?.[1];if(!season)throw Error("EPCR selected edition missing");
 const expected=competition==="champions-cup"?4:3;
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)];if(tables.length!==expected)throw Error("EPCR pool count incomplete");
 const rows:OfficialStanding[]=[];const seen=new Set<string>();
 for(const [index,table] of tables.entries()){
  const heading=[...html.slice(0,table.index).matchAll(/<h4\b[^>]*>[\s\S]*?<span>(Pool \d+)<\/span>[\s\S]*?<\/h4>/g)].at(-1)?.[1];
  if(heading!==`Pool ${index+1}`)throw Error("EPCR pool identity missing");
  const groupRows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].filter(r=>r[1].includes("<td"));if(groupRows.length!==6)throw Error("EPCR pool must contain all six clubs");
  for(const row of groupRows){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>plain(m[1]));
   const sourceSlug=row[1].match(new RegExp(`href="/${competition}/clubs/([^"/]+)"`))?.[1];const slug=sourceSlug?(aliases[sourceSlug]||sourceSlug):null;
   if(!slug||!snapshot.teams.some(t=>t.slug===slug)||seen.has(slug))throw Error("EPCR club identity ambiguous");seen.add(slug);
   if(cells.length!==13||[0,3,4,5,6,7,8,9,10,11,12].some(i=>!/^[-+]?\d+$/.test(cells[i])))throw Error("EPCR numeric columns changed");
   const [position,pts,pj,w,d,l,difference,tries,bo,bd,repeatPts]=[0,3,4,5,6,7,8,9,10,11,12].map(i=>Number(cells[i]));
   if(position<1||position>6||pj!==w+d+l||[pj,w,d,l,tries,bo,bd].some(v=>v<0)||pts!==repeatPts||rows.some(r=>r.group===heading&&r.position===position))throw Error("EPCR pool statistics inconsistent");
   rows.push({position,team:cells[2],slug,pj,w,d,l,pf:null,pa:null,pts,group:heading,difference,tries,bo,bd});
  }
 }
 if(rows.reduce((sum,r)=>sum+r.difference!,0)!==0)throw Error("EPCR full competition points difference unbalanced");
 return {competitionSlug:competition==="champions-cup"?"eu-champions-cup":"eu-challenge-cup",season,phase:"pool",sourceName:"EPCR",sourceUrl:`https://www.epcrugby.com/${competition}/matches/pool-tables`,checkedAt,roundDate:null,rows};
}
