"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrefs } from "@/lib/usePrefs";
import s from "@/app/agenda/daily.module.css";
import LanguagePicker from "./LanguagePicker";

export const NAV_COPY = {
  es: {agenda:"Agenda",leagues:"Competiciones",news:"Noticias",settings:"Configuración",sources:"Fuentes y cobertura"},
  en: {agenda:"Schedule",leagues:"Competitions",news:"News",settings:"Settings",sources:"Sources & coverage"},
  fr: {agenda:"Agenda",leagues:"Compétitions",news:"Actualités",settings:"Réglages",sources:"Sources et couverture"},
  it: {agenda:"Agenda",leagues:"Competizioni",news:"Notizie",settings:"Impostazioni",sources:"Fonti e copertura"},
};
export default function SiteHeader(){
  const {lang}=usePrefs(); const path=usePathname(); const c=NAV_COPY[lang];
  const links=[["/",c.agenda],["/leagues",c.leagues],["/news",c.news],["/watch","TV & Streams"],["/games",({es:"Desafíos",en:"Challenges",fr:"Défis",it:"Sfide"})[lang]],["/settings",c.settings]];
  return <header className={`${s.header} rn-site-header`}><div className={s.headerInner}>
    <Link href="/" className={s.brand} aria-label="RugbyNOW"><img src="/logo.png" alt="" width={34} height={34}/><span>RUGBY<b>NOW</b></span></Link>
    <nav aria-label="RugbyNOW">{links.map(([href,label])=><Link key={href} href={href} className={(href==="/"?path==="/"||path==="/agenda":path?.startsWith(href))?s.current:""}>{href==="/settings"&&<svg className="rn-settings-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 2-1 3 2 3-2 2 1 3-2-1-3 2-2-2-3-3-1-1-3H9Z"/><circle cx="12" cy="11" r="3"/></svg>}{label}</Link>)}</nav>
    <LanguagePicker/>
  </div></header>;
}
