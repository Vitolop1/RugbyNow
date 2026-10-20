"use client";
import Link from "next/link";
import type { Lang } from "@/lib/usePrefs";

type Props = {
  competitionSlug?: string | null; competitionName?: string | null;
  home?: string | null; away?: string | null; lang: Lang; className?: string;
};
// The agenda distinguishes verified destinations, country and dated listings.
// Generic third-party links must not masquerade as streams of this match.
export default function SuggestedWatchButton({lang,className}:Props) {
  const label={es:"Consultar agenda de TV",en:"Open TV guide",fr:"Consulter le guide TV",it:"Consulta la guida TV"}[lang];
  return <Link href="/agenda" onClick={event=>event.stopPropagation()} className={className || "inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white"}>{label}<span aria-hidden="true">↗</span></Link>;
}
