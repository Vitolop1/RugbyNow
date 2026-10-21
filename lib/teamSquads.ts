import data from "../data/team-squads.json";
import type {TeamSquad} from "./squads";
export function getTeamSquads(slug:string){return (data.squads as TeamSquad[]).filter(s=>s.teamSlug===slug).sort((a,b)=>(b.season||'').localeCompare(a.season||'')||b.checkedAt.localeCompare(a.checkedAt));}
export function getSquadPlayer(slug:string){
 for(const squad of [...data.squads as TeamSquad[]].sort((a,b)=>(b.season||'').localeCompare(a.season||'')||b.checkedAt.localeCompare(a.checkedAt))){const player=squad.players.find(p=>p.slug===slug||p.id===slug);if(player)return {player,squad};}
 return null;
}
export function getSquadPlayerIndex(){const players=new Map<string,{id:string;checkedAt:string}>();for(const squad of data.squads as TeamSquad[])for(const player of squad.players){const previous=players.get(player.id);if(!previous||previous.checkedAt<squad.checkedAt)players.set(player.id,{id:player.id,checkedAt:squad.checkedAt});}return [...players.values()];}
