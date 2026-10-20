"use client";
import {useEffect,useState} from "react";
import {isLiveDataDelayed} from "@/lib/liveRefresh";
import {getDateLocale} from "@/lib/dateLocale";
import {usePrefs} from "@/lib/usePrefs";
export default function LiveFreshness({status,updatedAt}:{status:string;updatedAt?:string|null}){
  const {lang,timeZone}=usePrefs();const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
  if(status!=="LIVE"&&status!=="HT")return null;
  const c={es:{last:"Marcador recibido",delayed:"Datos demorados; conservamos el último marcador.",unknown:"Sin una lectura reciente confirmada."},en:{last:"Score received",delayed:"Delayed data; showing the last score.",unknown:"No recent reading confirmed."},fr:{last:"Score reçu",delayed:"Données retardées ; dernier score conservé.",unknown:"Aucune lecture récente confirmée."},it:{last:"Risultato ricevuto",delayed:"Dati in ritardo; mostriamo l’ultimo risultato.",unknown:"Nessuna lettura recente confermata."}}[lang];
  const timestamp=Date.parse(updatedAt||"");
  const delayed=isLiveDataDelayed(status,updatedAt,now);
  return <p className={`rn-live-freshness ${delayed?"rn-live-delayed":""}`} role={delayed?"status":undefined}>{Number.isFinite(timestamp)?<>{c.last} <time dateTime={updatedAt!}>{new Intl.DateTimeFormat(getDateLocale(lang),{hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",timeZone}).format(timestamp)}</time>. </>:c.unknown} {delayed&&c.delayed}</p>;
}
