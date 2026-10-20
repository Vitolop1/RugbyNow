"use client";
import {BROADCAST_COUNTRIES,broadcastCountryLabel,type BroadcastCountry} from "@/lib/useBroadcastCountry";
import {usePrefs} from "@/lib/usePrefs";
export default function BroadcastCountrySelect({value,onChange}:{value:BroadcastCountry;onChange:(country:BroadcastCountry)=>void}){
  const {lang}=usePrefs();const label={es:"País de la transmisión",en:"Broadcast country",fr:"Pays de diffusion",it:"Paese della trasmissione"}[lang];
  return <label className="rn-broadcast-country"><span>TV</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value as BroadcastCountry)}>{BROADCAST_COUNTRIES.map(country=><option key={country} value={country}>{broadcastCountryLabel(country,lang)}</option>)}</select></label>;
}
