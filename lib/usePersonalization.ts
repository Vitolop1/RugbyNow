"use client";
import {useEffect,useState} from "react";
import {readSlugList,writeSlugList} from "./competitionPrefs";
export type RugbyPreferences={leagues:string[];clubs:string[];hidden:string[];density:"compact"|"comfortable";guides:boolean};
const defaults:RugbyPreferences={leagues:[],clubs:[],hidden:[],density:"compact",guides:true};
export function usePersonalization(){
  const [prefs,setPrefs]=useState<RugbyPreferences>(defaults);
  useEffect(()=>{
    const load=()=>{let extra:Partial<RugbyPreferences>={};try{const value=JSON.parse(localStorage.getItem("rn:personalization")||"{}");if(value&&typeof value==="object"&&!Array.isArray(value))extra=value;}catch{}
      setPrefs({leagues:readSlugList("rn:favorite-leagues"),clubs:readSlugList("rn:followed-clubs"),hidden:readSlugList("rn:hidden-leagues"),density:extra.density==="comfortable"?"comfortable":"compact",guides:extra.guides!==false});};
    load();window.addEventListener("rugby-preferences",load);window.addEventListener("storage",load);
    return()=>{window.removeEventListener("rugby-preferences",load);window.removeEventListener("storage",load);};
  },[]);
  function update(next:Partial<RugbyPreferences>){const value={...prefs,...next};writeSlugList("rn:favorite-leagues",value.leagues);writeSlugList("rn:followed-clubs",value.clubs);writeSlugList("rn:hidden-leagues",value.hidden);localStorage.setItem("rn:personalization",JSON.stringify({density:value.density,guides:value.guides}));window.dispatchEvent(new Event("rugby-preferences"));}
  return {prefs,update};
}
