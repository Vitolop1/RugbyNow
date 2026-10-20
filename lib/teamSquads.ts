import data from "../data/team-squads.json";
import type {TeamSquad} from "./squads";
export function getTeamSquads(slug:string){return (data.squads as TeamSquad[]).filter(s=>s.teamSlug===slug);}
export function getSquadPlayer(slug:string){
 for(const squad of data.squads as TeamSquad[]){const player=squad.players.find(p=>p.slug===slug||p.id===slug);if(player)return {player,squad};}
 return null;
}
export function getSquadPlayerIndex(){return (data.squads as TeamSquad[]).flatMap(s=>s.players.map(p=>({id:p.id,checkedAt:s.checkedAt})));}
