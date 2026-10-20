import {getProD2Team} from "./proD2";
export type OfficialProD2Fixture={sourceId:number;round:number;season:string;homeSlug:string;awaySlug:string;home:string;away:string;date:string|null;startsAt:string|null;windowFrom:string;windowTo:string;sourceUrl:string};
export type ProD2Calendar={sourceName:string;sourceUrl:string;checkedAt:string;season:string;fixtures:OfficialProD2Fixture[]};
function attributeJson(html:string,name:string){const raw=html.match(new RegExp(`:${name}='([^']+)'`))?.[1];if(!raw)throw Error(`LNR ${name} missing`);return JSON.parse(raw.replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&amp;/g,"&"));}
function parisDay(value:string){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris"}).format(new Date(value));}
function parisInstant(date:string,hour:number,minute:number){
 const base=Date.parse(`${date}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00Z`);
 const offset=new Intl.DateTimeFormat("en",{timeZone:"Europe/Paris",timeZoneName:"longOffset"}).formatToParts(new Date(base)).find(p=>p.type==="timeZoneName")?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
 if(!offset)throw Error("Cannot establish Paris UTC offset");
 return new Date(base-(Number(offset[2])*60+Number(offset[3]))*(offset[1]==="+"?1:-1)*60000).toISOString();
}
export function parseProD2CalendarRound(html:string,season:string,round:number):OfficialProD2Fixture[]{
 const current=attributeJson(html,"current-week"),edition=attributeJson(html,"current-season");
 if(edition.name!==season.replace("/","-")||current.number!==round||current.type!=="Journée régulière"||!current.full_name.includes(edition.name))throw Error("LNR calendar edition/round mismatch");
 const from=current.overridden_starts_at||current.starts_at,to=current.overridden_ends_at||current.ends_at;
 if(!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||Date.parse(to)<=Date.parse(from))throw Error("LNR round window missing");
 const windowFrom=parisDay(from),windowTo=parisDay(new Date(Date.parse(to)-1).toISOString());
 const main=html.slice(html.indexOf('<div class="calendar-results calendar-results--single">')).split('</main>')[0];
 const headers=[...main.matchAll(/class="calendar-results__fixture-date[^\"]*">\s*([^<]+)<\/div>/g)];
 const lines=[...main.matchAll(/<div class="calendar-results__line">/g)];
 const months=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
 const fixtures=lines.map((line,index):OfficialProD2Fixture=>{
  const block=main.slice(line.index,lines[index+1]?.index??main.length);
  const names=[...block.matchAll(/class="club-line__name base-link base-link--black"\s*>\s*([^<]+)<\/a>/g)].map(m=>m[1].trim());
  const home=getProD2Team(names[0]||""),away=getProD2Team(names[1]||"");
  const link=block.match(/href=['"](https:\/\/prod2\.lnr\.fr\/feuille-de-match\/(\d{4}-\d{4})\/j(\d+)\/(\d+)-[^'"\s]+)['"]/);
  if(names.length!==2||!home||!away||home.slug===away.slug||!link||link[2]!==edition.name||Number(link[3])!==round)throw Error("Incomplete or ambiguous LNR fixture");
  const dateLabel=headers.filter(h=>h.index!<line.index!).at(-1)?.[1].trim()||"";
  const explicit=[...dateLabel.matchAll(/\b(\d{1,2})\s+([a-zéû]+)\b/gi)];
  let date:string|null=null,startsAt:string|null=null;
  // A range is a round window, not a confirmed date for each of its matches.
  if(explicit.length===1&&!/[–—]|\s-\s/.test(dateLabel)){
   const month=months.indexOf(explicit[0][2].toLowerCase());if(month<0)throw Error("Unknown LNR month");
   const year=month>=6?season.slice(0,4):season.slice(-4);
   date=`${year}-${String(month+1).padStart(2,"0")}-${explicit[0][1].padStart(2,"0")}`;
   if(new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)throw Error("Invalid LNR fixture date");
   const time=block.match(/class="match-line__time">\s*(\d{1,2})h(\d{2})\s*<\/p>/);
   if(time){if(Number(time[1])>23||Number(time[2])>59)throw Error("Invalid LNR time");startsAt=parisInstant(date,Number(time[1]),Number(time[2]));}
  }
  // Explicit per-day headings supersede the nominal round window (e.g. J7
  // contains Saturday 17 October even though the week metadata ends Friday).
  return {sourceId:Number(link[4]),round,season,homeSlug:home.slug,awaySlug:away.slug,home:home.name,away:away.name,date,startsAt,windowFrom:date||windowFrom,windowTo:date||windowTo,sourceUrl:link[1]};
 });
 if(fixtures.length!==8||new Set(fixtures.map(m=>m.sourceId)).size!==8||new Set(fixtures.flatMap(m=>[m.homeSlug,m.awaySlug])).size!==16)throw Error("LNR round must contain eight fixtures and sixteen distinct clubs");
 return fixtures;
}
export function validateProD2Calendar(fixtures:OfficialProD2Fixture[]){
 if(fixtures.length!==240||new Set(fixtures.map(m=>m.sourceId)).size!==240||new Set(fixtures.map(m=>`${m.homeSlug}:${m.awaySlug}`)).size!==240)throw Error("Incomplete or repeated Pro D2 regular-season fixtures");
 for(let round=1;round<=30;round++){const rows=fixtures.filter(m=>m.round===round);if(rows.length!==8||new Set(rows.flatMap(m=>[m.homeSlug,m.awaySlug])).size!==16)throw Error(`Incomplete Pro D2 round ${round}`);}
}
