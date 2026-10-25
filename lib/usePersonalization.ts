"use client";
import {useEffect,useState} from "react";
import {readSlugList,writeSlugList} from "./competitionPrefs";
import {trackProductEvent} from './analytics';
export type RugbyPreferences={leagues:string[];clubs:string[];hidden:string[];density:"compact"|"comfortable";textSize:"standard"|"large";guides:boolean};
const defaults:RugbyPreferences={leagues:[],clubs:[],hidden:[],density:"compact",textSize:"standard",guides:true};
export function usePersonalization(){
  const [prefs,setPrefs]=useState<RugbyPreferences>(defaults);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const load=()=>{let extra:Partial<RugbyPreferences>={};try{const value=JSON.parse(localStorage.getItem("rn:personalization")||"{}");if(value&&typeof value==="object"&&!Array.isArray(value))extra=value;}catch{}
      setPrefs({leagues:readSlugList("rn:favorite-leagues"),clubs:readSlugList("rn:followed-clubs"),hidden:readSlugList("rn:hidden-leagues"),density:extra.density==="comfortable"?"comfortable":"compact",textSize:extra.textSize==="large"?"large":"standard",guides:extra.guides!==false});setReady(true);};
    load();window.addEventListener("rugby-preferences",load);window.addEventListener("storage",load);
    return()=>{window.removeEventListener("rugby-preferences",load);window.removeEventListener("storage",load);};
  },[]);
  function update(next:Partial<RugbyPreferences>){const value={...prefs,...next};writeSlugList("rn:favorite-leagues",value.leagues);writeSlugList("rn:followed-clubs",value.clubs);writeSlugList("rn:hidden-leagues",value.hidden);localStorage.setItem("rn:personalization",JSON.stringify({density:value.density,textSize:value.textSize,guides:value.guides}));window.dispatchEvent(new Event("rugby-preferences"));
    for(const slug of new Set([...prefs.leagues,...value.leagues]))if(prefs.leagues.includes(slug)!==value.leagues.includes(slug))trackProductEvent('league_follow',{competition_slug:slug,saved:value.leagues.includes(slug)?1:0});
    for(const slug of new Set([...prefs.clubs,...value.clubs]))if(prefs.clubs.includes(slug)!==value.clubs.includes(slug))trackProductEvent('club_follow',{club_slug:slug,saved:value.clubs.includes(slug)?1:0});
  }
  return {prefs,update,ready};
}
