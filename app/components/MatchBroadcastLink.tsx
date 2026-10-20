"use client";
import Link from "next/link";
import {getMatchTelevision,type MatchBroadcastQuery} from "@/lib/matchBroadcasts";
import {usePrefs} from "@/lib/usePrefs";
import {broadcastCountryLabel} from "@/lib/useBroadcastCountry";
import {trackProductEvent} from "@/lib/analytics";
import BroadcasterLogo from "./BroadcasterLogo";

export default function MatchBroadcastLink({query,guideHref,matchId}:{query:MatchBroadcastQuery;guideHref:string;matchId:number}){
  const {lang}=usePrefs();const listing=getMatchTelevision(query);
  const c={es:{pending:"TV por confirmar",source:"Fuente",platform:"Ir al canal o plataforma",note:"Disponibilidad para el país indicado. Puede requerir suscripción.",guide:"Ver guía de TV"},en:{pending:"TV unconfirmed",source:"Source",platform:"Open channel or platform",note:"Availability for the selected country. A subscription may be required.",guide:"Open TV guide"},fr:{pending:"TV à confirmer",source:"Source",platform:"Ouvrir la chaîne ou plateforme",note:"Disponibilité dans le pays indiqué. Abonnement possible.",guide:"Ouvrir le guide TV"},it:{pending:"TV da confermare",source:"Fonte",platform:"Apri canale o piattaforma",note:"Disponibilità nel paese indicato. Potrebbe richiedere un abbonamento.",guide:"Apri guida TV"}}[lang];
  if(!listing)return <Link className="rn-watch-link" href={guideHref} title={c.pending}>TV ↗</Link>;
  return <details className="rn-match-tv"><summary title={`${listing.providers.map(p=>p.name).join(" / ")} · ${broadcastCountryLabel(query.country,lang)}`}><BroadcasterLogo id={listing.providers[0].id} name={listing.providers[0].name}/>{listing.pending&&<small className="rn-tv-pending">{c.pending}</small>}{listing.providers.length>1&&<small>+{listing.providers.length-1}</small>}<span aria-hidden="true">⌄</span></summary>
    <div className="rn-match-tv-panel"><strong>TV · {broadcastCountryLabel(query.country,lang)}</strong>{listing.pending&&<p className="rn-tv-pending">{c.pending}</p>}
      {listing.providers.map(provider=><div className="rn-match-tv-provider" key={provider.id}><BroadcasterLogo id={provider.id} name={provider.name}/>{provider.href&&!listing.pending?<a href={provider.href} title={c.platform} target="_blank" rel="noopener noreferrer" onClick={()=>trackProductEvent("watch_provider_click",{match_id:matchId,provider_id:provider.id,link_type:provider.linkType||"channel"})}>{provider.name} ↗</a>:<span>{provider.name}</span>}</div>)}
      <p>{c.source}: {listing.sourceUrl?<a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer">{listing.sourceName} ↗</a>:listing.sourceName}</p><p>{c.note}</p><Link href={guideHref}>{c.guide} →</Link>
    </div>
  </details>;
}
