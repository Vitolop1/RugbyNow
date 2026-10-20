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
      <Link className="rn-settings-button" href="/settings" aria-label={c.settings} title={c.settings} aria-current={current("/settings")?"page":undefined}><svg className="rn-settings-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 3-.8 2.7-2.5 1L3.2 6l-1.5 2.6 1.7 2.1v2.6l-1.7 2.1L3.2 18l2.5-.7 2.5 1L9 21h3l.8-2.7 2.5-1 2.5.7 1.5-2.6-1.7-2.1v-2.6l1.7-2.1L17.8 6l-2.5.7-2.5-1L12 3H9Z" transform="translate(1.5)"/><circle cx="12" cy="12" r="3"/></svg></Link>
      <LanguagePicker/>
      <div className="rn-more-menu" ref={menu} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}>
        <button ref={trigger} type="button" className="rn-more-button" aria-label={c.more} title={c.more} aria-expanded={open} aria-controls="rn-more-links" onClick={()=>setOpen(value=>!value)}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
        {open&&<div className="rn-more-links" id="rn-more-links">{link("/games",c.games)}{link("/sources",c.sources)}</div>}
      </div>
    </div>
  </div></header>;
}
