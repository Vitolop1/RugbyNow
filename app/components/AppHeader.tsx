"use client";
import type {ReactNode} from "react";
import SiteHeader from "./SiteHeader";
import type {Lang} from "@/lib/usePrefs";
type Props={title?:ReactNode;subtitle?:string;showTabs?:boolean;tab?:"ALL"|"LIVE";setTab?:(tab:"ALL"|"LIVE")=>void;lang?:Lang;onLangChange?:(lang:Lang)=>void};
export default function AppHeader({title,subtitle,showTabs,tab,setTab}:Props){return <><SiteHeader/>{(title||subtitle||showTabs)&&<div className="rn-header-caption">{title}{subtitle&&<p>{subtitle}</p>}{showTabs&&<div><button aria-pressed={tab==="ALL"} onClick={()=>setTab?.("ALL")}>All</button><button aria-pressed={tab==="LIVE"} onClick={()=>setTab?.("LIVE")}>Live</button></div>}</div>}</>;}
