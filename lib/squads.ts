export type SquadPlayer={id:string;slug:string;name:string;position:string;country?:string;sourceUrl:string};
export type TeamSquad={teamSlug:string;kind:"season-squad"|"call-up"|"club-directory";season:string|null;seasonEvidence?:string;sourceName:string;sourceUrl:string;checkedAt:string;players:SquadPlayer[]};
export function validateSquadIdentities(squads:TeamSquad[]){
 const seen=new Map<string,string>();
 for(const squad of squads)for(const player of squad.players){
  const key=`${squad.season||'directory'}:${player.id}`;
  const previous=seen.get(key);
  if(previous&&previous!==squad.teamSlug)throw Error(`Ambiguous player membership in ${squad.season||'directory'}: ${player.id}; previous rosters preserved`);
  seen.set(key,squad.teamSlug);
 }
}
export function parseLnrSquad(html:string,teamSlug:string,sourceUrl:string,checkedAt=new Date().toISOString()):TeamSquad {
 if(html.length>2_000_000||!html.includes('Effectif et staff du club'))throw Error("LNR player directory missing");
 const domain=new URL(sourceUrl).hostname;
 if(!["prod2.lnr.fr","top14.lnr.fr"].includes(domain))throw Error("Unexpected LNR source domain");
 const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1]||"";
 const edition=description.match(/effectif[^()]+\((20\d{2})-(20\d{2})\) par poste/);
 if(edition&&Number(edition[2])!==Number(edition[1])+1)throw Error("Invalid squad edition");
 const players:SquadPlayer[]=[];
 const text=(s:string)=>s.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&#039;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
 for(const block of html.matchAll(/<a href="(https:\/\/(?:prod2|top14)\.lnr\.fr\/joueur\/(\d+)-([a-z0-9-]+))" class="player-block[^>]*>([\s\S]*?)<\/a>/g)){
  if(new URL(block[1]).hostname!==domain)throw Error("Player source domain mismatch");
  const name=text(block[4].match(/class="player-block__name">([\s\S]*?)<\/p>/)?.[1]||"");
  const position=text(block[4].match(/class="player-block__position">([\s\S]*?)<\/p>/)?.[1]||"");
  const country=block[4].match(/<img\s+alt="([^"]+)"[^>]*class="player-block__country/)?.[1];
  if(!name||!position)throw Error("Incomplete player identity");
  players.push({id:`lnr-${block[2]}`,slug:`lnr-${block[2]}-${block[3]}`,name,position,sourceUrl:block[1],...(country?{country:text(country)}:{})});
 }
 const sourceCount=[...html.matchAll(/class="player-block /g)].length;
 if(players.length<20||players.length!==sourceCount||new Set(players.map(p=>p.id)).size!==players.length)throw Error("Incomplete or duplicate LNR directory");
 // Only an explicit source edition qualifies as a seasonal roster; never use the current year.
 return {teamSlug,kind:edition?"season-squad":"club-directory",season:edition?`${edition[1]}/${edition[2]}`:null,...(edition?{seasonEvidence:text(description)}:{}),sourceName:domain==="top14.lnr.fr"?"LNR · Top 14":"LNR · Pro D2",sourceUrl,checkedAt,players};
}
