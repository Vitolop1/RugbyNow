"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrefs, type Lang } from "@/lib/usePrefs";
import s from "@/app/agenda/daily.module.css";

export const NAV_COPY = {
  es: {agenda:"Agenda",leagues:"Competiciones",news:"Noticias",settings:"Mi Rugby",sources:"Fuentes y cobertura"},
  en: {agenda:"Schedule",leagues:"Competitions",news:"News",settings:"My Rugby",sources:"Sources & coverage"},
  fr: {agenda:"Agenda",leagues:"Compétitions",news:"Actualités",settings:"Mon Rugby",sources:"Sources et couverture"},
  it: {agenda:"Agenda",leagues:"Competizioni",news:"Notizie",settings:"Il mio Rugby",sources:"Fonti e copertura"},
};
export default function SiteHeader(){
  const {lang,setLangEverywhere}=usePrefs(); const path=usePathname(); const c=NAV_COPY[lang];
  const links=[["/",c.agenda],["/leagues",c.leagues],["/news",c.news],["/settings",c.settings]];
  return <header className={`${s.header} rn-site-header`}><div className={s.headerInner}>
    <Link href="/" className={s.brand} aria-label="RugbyNOW"><img src="/logo.png" alt="" width={34} height={34}/><span>RUGBY<b>NOW</b></span></Link>
    <nav aria-label="RugbyNOW">{links.map(([href,label])=><Link key={href} href={href} className={(href==="/"?path==="/"||path==="/agenda":path?.startsWith(href))?s.current:""}>{label}</Link>)}</nav>
    <label className={s.language}><select value={lang} onChange={e=>setLangEverywhere(e.target.value as Lang)} aria-label="Language"><option value="es">ES</option><option value="en">EN</option><option value="fr">FR</option><option value="it">IT</option></select></label>
  </div></header>;
}
