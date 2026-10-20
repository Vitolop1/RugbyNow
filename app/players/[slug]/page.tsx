import {notFound} from "next/navigation";
import {getSquadPlayer} from "@/lib/teamSquads";
import snapshot from "@/data/supabase-snapshot.json";
import PlayerClient from "./PlayerClient";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const entry=getSquadPlayer(slug);return {title:`${entry?.player.name||"Jugador"} | RugbyNOW`,alternates:entry?{canonical:`/players/${entry.player.id}`}:undefined};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const entry=getSquadPlayer(slug);if(!entry)notFound();const {players,...squad}=entry.squad;return <PlayerClient player={entry.player} squad={squad} teamName={snapshot.teams.find(t=>t.slug===entry.squad.teamSlug)?.name||entry.squad.teamSlug}/>;}
