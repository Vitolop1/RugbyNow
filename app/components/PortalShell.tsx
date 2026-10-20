import type { ReactNode } from "react";
import Link from "next/link";
import SiteHeader from "./SiteHeader";
import s from "@/app/agenda/daily.module.css";
export default function PortalShell({title,subtitle,children}:{title:string;subtitle?:string;children:ReactNode}){
  return <div className={s.page}><SiteHeader/><main className={`${s.main} rn-portal`}><div className={s.titleRow}><div><p className={s.eyebrow}>RUGBYNOW</p><h1>{title}<span className={s.titleDot}>.</span></h1>{subtitle&&<p>{subtitle}</p>}</div></div>{children}<footer className={s.footer}><b>RUGBYNOW</b><Link href="/">Agenda</Link><Link href="/sources">Fuentes / Sources</Link><Link href="/privacy">Privacy</Link></footer></main></div>;
}
