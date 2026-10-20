"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePrefs } from "@/lib/usePrefs";
import s from "@/app/agenda/daily.module.css";
import LanguagePicker from "./LanguagePicker";

export const NAV_COPY = {
  es: {agenda:"Agenda",leagues:"Competiciones",news:"Noticias",settings:"Configuración",sources:"Fuentes y cobertura",more:"Más",games:"Desafíos"},
  en: {agenda:"Schedule",leagues:"Competitions",news:"News",settings:"Settings",sources:"Sources & coverage",more:"More",games:"Challenges"},
  fr: {agenda:"Agenda",leagues:"Compétitions",news:"Actualités",settings:"Réglages",sources:"Sources et couverture",more:"Plus",games:"Défis"},
  it: {agenda:"Agenda",leagues:"Competizioni",news:"Notizie",settings:"Impostazioni",sources:"Fonti e copertura",more:"Altro",games:"Sfide"},
};
export default function SiteHeader(){
  const {lang}=usePrefs(); const path=usePathname(); const c=NAV_COPY[lang];
  const [open,setOpen]=useState(false);const menu=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>setOpen(false),[path]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);trigger.current?.focus();}};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  const current=(href:string)=>href==="/"?path==="/"||path==="/agenda":!!path?.startsWith(href);
  const link=(href:string,label:string)=><Link key={href} href={href} aria-current={current(href)?"page":undefined} className={current(href)?s.current:""}>{label}</Link>;
  return <header className={`${s.header} rn-site-header`}><div className={s.headerInner}>
    <Link href="/" className={s.brand} aria-label="RugbyNOW"><img src="/logo.png" alt="" width={34} height={34}/><span>RUGBY<b>NOW</b></span></Link>
    <nav className="rn-primary-nav" aria-label="RugbyNOW">{link("/",c.agenda)}{link("/leagues",c.leagues)}{link("/news",c.news)}{link("/watch","TV & Streams")}</nav>
    <div className="rn-header-tools">
      <Link className="rn-settings-button" href="/settings" aria-label={c.settings} title={c.settings} aria-current={current("/settings")?"page":undefined}><svg className="rn-settings-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><polygon points="19.04,9.71 21.42,10.17 21.42,13.83 19.04,14.29 18.59,15.36 19.96,17.37 17.37,19.96 15.36,18.59 14.29,19.04 13.83,21.42 10.17,21.42 9.71,19.04 8.64,18.59 6.63,19.96 4.04,17.37 5.41,15.36 4.96,14.29 2.58,13.83 2.58,10.17 4.96,9.71 5.41,8.64 4.04,6.63 6.63,4.04 8.64,5.41 9.71,4.96 10.17,2.58 13.83,2.58 14.29,4.96 15.36,5.41 17.37,4.04 19.96,6.63 18.59,8.64" strokeLinejoin="round"/><circle cx="12" cy="12" r="3"/></svg></Link>
      <LanguagePicker/>
      <div className="rn-more-menu" ref={menu} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}>
        <button ref={trigger} type="button" className="rn-more-button" aria-label={c.more} title={c.more} aria-expanded={open} aria-controls="rn-more-links" onClick={()=>setOpen(value=>!value)}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
        {open&&<div className="rn-more-links" id="rn-more-links">{link("/games",c.games)}{link("/sources",c.sources)}</div>}
      </div>
    </div>
  </div></header>;
}
