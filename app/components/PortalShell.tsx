import type { ReactNode } from "react";
import Link from "next/link";
import SiteHeader from "./SiteHeader";
import CompetitionSidebar from "./CompetitionSidebar";
import AdvertisingPlacement from "./AdvertisingPlacement";
import s from "@/app/agenda/daily.module.css";
export default function PortalShell({title,subtitle,children,advertising=true}:{title:string;subtitle?:string;children:ReactNode;advertising?:boolean}){
  return <div className={s.page}><SiteHeader/><main className={`${s.main} rn-portal rn-sports-main`}>
    <div className={`rn-sports-grid ${advertising?"":"rn-no-ad-rail"}`}>
      <CompetitionSidebar/>
      <div className="rn-sports-content">
        <div className={s.titleRow}><div><p className={s.eyebrow}>RUGBYNOW</p><h1>{title}<span className={s.titleDot}>.</span></h1>{subtitle&&<p>{subtitle}</p>}</div></div>
        {advertising&&<AdvertisingPlacement placement="leaderboard"/>}
        {children}
        <footer className={s.footer}><b>RUGBYNOW</b><Link href="/">Agenda</Link><Link href="/advertise">Publicidad / Ads</Link><Link href="/sources">Fuentes / Sources</Link><Link href="/privacy">Privacy</Link></footer>
      </div>
      {advertising&&<aside className="rn-ad-rail"><AdvertisingPlacement placement="rail"/></aside>}
    </div>
  </main></div>;
}
