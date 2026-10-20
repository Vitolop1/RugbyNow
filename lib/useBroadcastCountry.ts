"use client";
import {useEffect,useState} from "react";
import type {Lang} from "./usePrefs";
export type BroadcastCountry="AR"|"FR"|"GB"|"US"|"IT"|"other";
export const BROADCAST_COUNTRIES:BroadcastCountry[]=["AR","FR","GB","US","IT","other"];
const names={es:["Argentina","Francia","Reino Unido","Estados Unidos","Italia","Otros países"],en:["Argentina","France","United Kingdom","United States","Italy","Other countries"],fr:["Argentine","France","Royaume-Uni","États-Unis","Italie","Autres pays"],it:["Argentina","Francia","Regno Unito","Stati Uniti","Italia","Altri paesi"]};
export function broadcastCountryLabel(country:string,lang:Lang){return names[lang][BROADCAST_COUNTRIES.indexOf(country as BroadcastCountry)]||names[lang][5];}
export function useBroadcastCountry(defaultCountry:BroadcastCountry="AR"){
  const [country,setCountry]=useState<BroadcastCountry>(defaultCountry);
  useEffect(()=>{const load=()=>{try{const saved=localStorage.getItem("rn:tv-country");if(BROADCAST_COUNTRIES.includes(saved as BroadcastCountry))setCountry(saved as BroadcastCountry);}catch{}};load();window.addEventListener("storage",load);window.addEventListener("rugby-tv-country",load);return()=>{window.removeEventListener("storage",load);window.removeEventListener("rugby-tv-country",load);};},[]);
  function choose(next:BroadcastCountry){if(!BROADCAST_COUNTRIES.includes(next))return;setCountry(next);try{localStorage.setItem("rn:tv-country",next);}catch{}window.dispatchEvent(new Event("rugby-tv-country"));}
  return {country,setCountry:choose};
}
