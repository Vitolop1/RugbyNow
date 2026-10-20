export type SquadPlayer={id:string;slug:string;name:string;position:string;country?:string;sourceUrl:string};
export type TeamSquad={teamSlug:string;kind:"season-squad"|"call-up"|"club-directory";season:string|null;sourceName:string;sourceUrl:string;checkedAt:string;players:SquadPlayer[]};
export function parseLnrSquad(html:string,teamSlug:string,sourceUrl:string,checkedAt=new Date().toISOString()):TeamSquad {
 if(html.length>2_000_000||!html.includes('Effectif et staff du club'))throw Error("LNR player directory missing");
 const players:SquadPlayer[]=[];
 const text=(s:string)=>s.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&#039;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
 for(const block of html.matchAll(/<a href="(https:\/\/prod2\.lnr\.fr\/joueur\/(\d+)-([a-z0-9-]+))" class="player-block[^>]*>([\s\S]*?)<\/a>/g)){
  const name=text(block[4].match(/class="player-block__name">([\s\S]*?)<\/p>/)?.[1]||"");
  const position=text(block[4].match(/class="player-block__position">([\s\S]*?)<\/p>/)?.[1]||"");
  const country=block[4].match(/<img\s+alt="([^"]+)"[^>]*class="player-block__country/)?.[1];
  if(!name||!position)throw Error("Incomplete player identity");
  players.push({id:`lnr-${block[2]}`,slug:`lnr-${block[2]}-${block[3]}`,name,position,sourceUrl:block[1],...(country?{country:text(country)}:{})});
 }
 const sourceCount=[...html.matchAll(/class="player-block /g)].length;
 if(players.length<20||players.length!==sourceCount||new Set(players.map(p=>p.id)).size!==players.length)throw Error("Incomplete or duplicate LNR directory");
 // The directory itself does not label an edition: do not turn it into a season squad.
 return {teamSlug,kind:"club-directory",season:null,sourceName:"LNR · Pro D2",sourceUrl,checkedAt,players};
}
