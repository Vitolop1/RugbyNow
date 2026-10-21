import {top14Teams} from './officialStandings';
import {sourceTeamName} from './sourceTeamIdentity';
const aliases:Record<string,string>={'Bordeaux Bègles':'bordeaux-begles','Stade Français':'stade-francais','Toulon':'toulon','ASM Clermont Auvergne':'asm-clermont-auvergne','Bayonne':'bayonne','Lyon':'lyon','Vannes':'vannes'};
const identities=new Map([...Object.entries(top14Teams),...Object.entries(aliases)].map(([name,slug])=>[sourceTeamName(name),slug]));
export function getTop14Team(name:string){const slug=identities.get(sourceTeamName(name));return slug?{slug,name}:null;}
