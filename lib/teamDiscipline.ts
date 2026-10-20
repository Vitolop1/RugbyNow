import {rugbyDiscipline,type RugbyDiscipline} from "./headToHead";

/** Shared country IDs do not imply shared XV/sevens results or statistics. */
export function teamDisciplineSelection(competitionSlugs:string[],requested?:string){
 const available=[...new Set(competitionSlugs.map(rugbyDiscipline))];
 const selected=available.includes(requested as RugbyDiscipline)?requested as RugbyDiscipline:available.includes("rugby-union")?"rugby-union":available[0]||"rugby-union";
 return {available,selected};
}
