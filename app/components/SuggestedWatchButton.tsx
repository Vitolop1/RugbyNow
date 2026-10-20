"use client";
import Link from "next/link";
import ExternalWatchOptions from "./ExternalWatchOptions";
import type { Lang } from "@/lib/usePrefs";
import {trackProductEvent} from "@/lib/analytics";

type Props = {
  competitionSlug?: string | null; competitionName?: string | null;
  home?: string | null; away?: string | null; lang: Lang; className?: string;
  match?: {id:number;date:string};
};
// The agenda distinguishes verified destinations, country and dated listings.
// Generic third-party links must not masquerade as streams of this match.
export default function SuggestedWatchButton({lang,className,match,competitionSlug}:Props) {
  const label={es:"Consultar agenda de TV",en:"Open TV guide",fr:"Consulter le guide TV",it:"Consulta la guida TV"}[lang];
  const href=match?`/agenda?date=${encodeURIComponent(match.date)}&event=match-${match.id}#match-${match.id}`:"/agenda";
  return <div className="rn-watch-options"><Link href={href} onClick={event=>{event.stopPropagation();trackProductEvent("watch_options_open",{match_id:match?.id || "agenda",competition:competitionSlug || "all"});}} className={className || "inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white"}>{label}<span aria-hidden="true">↗</span></Link><ExternalWatchOptions/></div>;
}
