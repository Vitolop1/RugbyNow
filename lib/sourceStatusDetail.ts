export type SourceStatusDetail="postponed"|"delayed"|"suspended"|"abandoned"|"cancelled"|"walkover"|"awarded"|"extra-time"|"after-extra-time"|"shootout";
export function detectSourceStatusDetail(raw:string):SourceStatusDetail|null {
 const text=raw.toUpperCase();
 if(/POSTP/.test(text))return "postponed";if(/DELAY/.test(text))return "delayed";
 if(/SUSP|INTERRUPT/.test(text))return "suspended";if(/ABAND|\bABD\b/.test(text))return "abandoned";
 if(/CANC/.test(text))return "cancelled";if(/WALK.?OVER|\bWO\b/.test(text))return "walkover";
 if(/AWARD|\bAWD\b/.test(text))return "awarded";if(/\bAET\b|AFTER EXTRA TIME/.test(text))return "after-extra-time";
 if(/SHOOT.?OUT|PENALTIES/.test(text))return "shootout";if(/EXTRA TIME|^ET\b/.test(text))return "extra-time";return null;
}
const details:SourceStatusDetail[]=["postponed","delayed","suspended","abandoned","cancelled","walkover","awarded","extra-time","after-extra-time","shootout"];
// Preserve provider qualifiers alongside the existing rn_phase/rn_stage source
// fragment. Database status remains compatible with the installed constraint.
export function appendSourceStatusDetail(sourceUrl:string,detail:SourceStatusDetail|null){
 const url=new URL(sourceUrl),params=new URLSearchParams(url.hash.slice(1));params.delete("rn_status");if(detail)params.set("rn_status",detail);url.hash=params.toString();return url.toString();
}
export function readSourceStatusDetail(sourceUrl?:string|null):SourceStatusDetail|null {
 if(!sourceUrl)return null;try{const value=new URLSearchParams(new URL(sourceUrl).hash.slice(1)).get("rn_status");return details.includes(value as SourceStatusDetail)?value as SourceStatusDetail:null;}catch{return null;}
}
export function sourceStatusLabel(sourceUrl:string|null|undefined,lang:"es"|"en"|"fr"|"it"){
 const detail=readSourceStatusDetail(sourceUrl);if(!detail)return null;
 const labels={es:{postponed:"Aplazado",delayed:"Demorado",suspended:"Suspendido",abandoned:"Abandonado",cancelled:"Cancelado",walkover:"Sin disputa · W/O",awarded:"Resultado adjudicado","extra-time":"Prórroga","after-extra-time":"Final tras prórroga",shootout:"Desempate por penales"},en:{postponed:"Postponed",delayed:"Delayed",suspended:"Suspended",abandoned:"Abandoned",cancelled:"Cancelled",walkover:"Walkover",awarded:"Awarded","extra-time":"Extra time","after-extra-time":"Final after extra time",shootout:"Penalty shootout"},fr:{postponed:"Reporté",delayed:"Retardé",suspended:"Suspendu",abandoned:"Abandonné",cancelled:"Annulé",walkover:"Forfait",awarded:"Résultat attribué","extra-time":"Prolongation","after-extra-time":"Terminé après prolongation",shootout:"Tirs au but"},it:{postponed:"Rinviato",delayed:"Ritardato",suspended:"Sospeso",abandoned:"Abbandonato",cancelled:"Annullato",walkover:"Forfait",awarded:"Risultato assegnato","extra-time":"Supplementari","after-extra-time":"Finale dopo supplementari",shootout:"Calci di spareggio"}};
 return labels[lang][detail];
}
