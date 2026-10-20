"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {usePrefs} from "@/lib/usePrefs";
import {AD_PUBLISHER,AD_UNITS} from "@/lib/advertising";
import {trackProductEvent} from "@/lib/analytics";

const words={es:{ad:"Publicidad",contact:"Publicidad y patrocinios"},en:{ad:"Advertisement",contact:"Advertising & sponsorships"},fr:{ad:"Publicité",contact:"Publicité et partenariats"},it:{ad:"Pubblicità",contact:"Pubblicità e sponsorizzazioni"}};

export default function AdvertisingPlacement({placement}:{placement:"rail"|"leaderboard"}){
  const {lang}=usePrefs();const c=words[lang];const node=useRef<HTMLModElement>(null);
  const pushed=useRef(false);const [status,setStatus]=useState("pending");
  const slot=AD_UNITS[placement];
  useEffect(()=>{
    const ad=node.current;if(!ad)return;
    if(!/^\d+$/.test(slot)||/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){setStatus("unavailable");return;}
    const timeout=window.setTimeout(()=>{if(ad.getAttribute("data-ad-status")!=="filled")setStatus("unavailable");},12000);
    const report=()=>setStatus(ad.getAttribute("data-ad-status")||"pending");
    const mutation=new MutationObserver(report);mutation.observe(ad,{attributes:true,attributeFilter:["data-ad-status"]});
    const request=()=>{
      if(pushed.current||ad.getBoundingClientRect().width<100||!ad.getClientRects().length)return;
      try{(window.adsbygoogle=window.adsbygoogle||[]).push({});pushed.current=true;}catch{setStatus("unavailable");}
    };
    const visibility=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))request();},{rootMargin:"100px"});visibility.observe(ad);
    const resize=new ResizeObserver(()=>{const box=ad.getBoundingClientRect();if(box.bottom>0&&box.top<innerHeight+100)request();});resize.observe(ad);
    return()=>{window.clearTimeout(timeout);mutation.disconnect();visibility.disconnect();resize.disconnect();};
  },[slot]);
  return <section className={`rn-ad-placement rn-ad-${placement}`} data-ad-placement={placement} hidden={status==="unfilled"||status==="unavailable"} aria-label={c.ad}>
    <div className="rn-ad-label">{c.ad}</div>
    <div className="rn-ad-inventory" data-delivery={status}>
      <ins ref={node} className="adsbygoogle" style={{display:status==="unfilled"?"none":"block",width:"100%"}} data-ad-client={AD_PUBLISHER} data-ad-slot={slot} data-ad-format={placement==="rail"?"vertical":"horizontal"} data-full-width-responsive="false"/>

    </div>
    <Link className="rn-ad-contact" href="/advertise" onClick={()=>trackProductEvent("sponsor_contact_click",{placement,action:"open_advertising"})}>{c.contact} ↗</Link>
  </section>;
}
