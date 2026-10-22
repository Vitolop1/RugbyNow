"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "@/lib/usePrefs";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    rugbyAnalyticsAllowed?: boolean;
  }
}

const words = {
  es: {title:"Estadísticas opcionales",body:"¿Nos permitís medir visitas y clics con Google Analytics para mejorar Rugby Now? Podés cambiar tu elección en cualquier momento.",yes:"Permitir",no:"Rechazar",manage:"Estadísticas",privacy:"Privacidad"},
  en: {title:"Optional analytics",body:"May we measure visits and clicks with Google Analytics to improve Rugby Now? You can change your choice at any time.",yes:"Allow",no:"Decline",manage:"Analytics",privacy:"Privacy"},
  fr: {title:"Statistiques facultatives",body:"Acceptez-vous la mesure des visites et clics avec Google Analytics pour améliorer Rugby Now ? Vous pouvez changer d’avis à tout moment.",yes:"Accepter",no:"Refuser",manage:"Statistiques",privacy:"Confidentialité"},
  it: {title:"Statistiche facoltative",body:"Possiamo misurare visite e clic con Google Analytics per migliorare Rugby Now? Puoi cambiare la scelta in qualsiasi momento.",yes:"Consenti",no:"Rifiuta",manage:"Statistiche",privacy:"Privacy"},
};
type Choice = "granted" | "denied" | null;

export default function GoogleAnalyticsPageview({ measurementId }: { measurementId: string }) {
  const { lang } = usePrefs();
  const copy = words[lang];
  const [choice, setChoice] = useState<Choice>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadTag, setLoadTag] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    let saved: Choice = null;
    try { const value = localStorage.getItem("rn:analytics-consent"); if (value === "granted" || value === "denied") saved = value; } catch { /* The choice still works for this page. */ }
    setChoice(saved);
    setOpen(saved === null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const allowed = choice === "granted";
    window.rugbyAnalyticsAllowed = allowed;
    (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = !allowed;
    if (!allowed) {
      if (initialized.current) window.gtag?.("consent", "update", {analytics_storage:"denied"});
      initialized.current = false;
      setLoadTag(false);
      return;
    }
    if (initialized.current) return;
    initialized.current = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
    window.gtag("consent", "default", {analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
    window.gtag("consent", "update", {analytics_storage:"granted"});
    window.gtag("js", new Date());
    // Enhanced Measurement handles history changes; do not send a second manual page_view.
    window.gtag("config", measurementId, {allow_google_signals:false,allow_ad_personalization_signals:false,debug_mode:location.hostname === "localhost" || location.hostname === "127.0.0.1"});
    setLoadTag(true);
  }, [choice, measurementId]);

  function choose(value: Exclude<Choice, null>) {
    try { localStorage.setItem("rn:analytics-consent", value); } catch { /* Memory-only choice. */ }
    setChoice(value);
    setOpen(false);
  }

  return <>
    {loadTag && choice === "granted" && <Script id="rugby-analytics-tag" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />}
    {loaded && (open ? <section aria-label={copy.title} className="rn-analytics-consent fixed bottom-3 left-3 right-3 z-[160] mx-auto max-w-xl rounded-xl border border-emerald-900/20 bg-white p-4 text-slate-800 shadow-xl sm:left-auto sm:mr-3">
      <strong className="text-sm">{copy.title}</strong><p className="mt-2 text-sm leading-relaxed">{copy.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3"><button onClick={() => choose("denied")} className="min-h-10 rounded-lg border border-emerald-800 px-4 text-sm font-semibold text-emerald-900">{copy.no}</button><button onClick={() => choose("granted")} className="min-h-10 rounded-lg border border-emerald-800 px-4 text-sm font-semibold text-emerald-900">{copy.yes}</button><a href="/privacy" className="ml-auto text-xs underline">{copy.privacy}</a></div>
    </section> : <button className="fixed bottom-2 right-2 z-[140] min-h-8 rounded-lg border border-slate-300 bg-white/95 px-3 text-xs text-slate-700 shadow-sm" onClick={() => setOpen(true)}>{copy.manage}</button>)}
  </>;
}

