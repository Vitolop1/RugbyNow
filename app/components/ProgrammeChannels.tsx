"use client";
import type {AgendaProvider} from "@/lib/agenda";
import type {Lang} from "@/lib/usePrefs";
import {trackProductEvent} from "@/lib/analytics";

export default function ProgrammeChannels({providers,eventId,lang}:{providers:AgendaProvider[];eventId:string;lang:Lang}){
  const c={es:{channel:"Abrir canal",platform:"Abrir plataforma",pending:"Enlace por confirmar"},en:{channel:"Open channel",platform:"Open platform",pending:"Link unconfirmed"},fr:{channel:"Ouvrir la chaîne",platform:"Ouvrir la plateforme",pending:"Lien à confirmer"},it:{channel:"Apri canale",platform:"Apri piattaforma",pending:"Link da confermare"}}[lang];
  return <div className="rn-programme-channels">{providers.map(provider=>{
    const youtube=!!provider.href&&/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(provider.href);
    return provider.href?<a key={provider.id} href={provider.href} target="_blank" rel="noopener noreferrer" title={`${provider.name} · ${provider.linkType==="platform"?c.platform:c.channel}`} aria-label={`${youtube?"YouTube · ":""}${provider.name} · ${provider.linkType==="platform"?c.platform:c.channel}`} onClick={()=>trackProductEvent("watch_provider_click",{provider_id:provider.id,event_id:eventId,link_type:provider.linkType||"channel"})}>
      {youtube?<img src="/broadcast-logos/youtube.png" alt="YouTube" width={24} height={18}/>:<span aria-hidden="true">↗</span>}<span>{provider.name}</span>
    </a>:<small key={provider.id} title={provider.name}>{c.pending}</small>;
  })}</div>;
}
