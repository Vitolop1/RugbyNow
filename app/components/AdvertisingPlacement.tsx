"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {usePrefs} from "@/lib/usePrefs";
import {AD_PUBLISHER,AD_UNITS} from "@/lib/advertising";
import {trackProductEvent} from "@/lib/analytics";

const words={
  es:{ad:"Publicidad",brand:"TU MARCA",rugby:"EN EL RUGBY",intro:"Conectá con quienes viven este deporte.",cta:"Anunciá en RugbyNOW",more:"Consultá por este espacio",contact:"Publicidad y patrocinios"},
  en:{ad:"Advertisement",brand:"YOUR BRAND",rugby:"IN RUGBY",intro:"Connect with people who live for this sport.",cta:"Advertise on RugbyNOW",more:"Ask about this space",contact:"Advertising & sponsorships"},
  fr:{ad:"Publicité",brand:"VOTRE MARQUE",rugby:"DANS LE RUGBY",intro:"Rencontrez les passionnés de ce sport.",cta:"Annoncez sur RugbyNOW",more:"Découvrez cet espace",contact:"Publicité et partenariats"},
  it:{ad:"Pubblicità",brand:"IL TUO MARCHIO",rugby:"NEL RUGBY",intro:"Raggiungi chi vive questo sport.",cta:"Pubblicizza su RugbyNOW",more:"Scopri questo spazio",contact:"Pubblicità e sponsorizzazioni"},
};

export default function AdvertisingPlacement({placement}:{placement:"rail"|"leaderboard"}){
  const {lang}=usePrefs();const c=words[lang];const node=useRef<HTMLModElement>(null);
  const pushed=useRef(false);const [status,setStatus]=useState("pending");
  const slot=AD_UNITS[placement];
  useEffect(()=>{
    const ad=node.current;if(!ad)return;
    if(!/^\d+$/.test(slot)||/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){setStatus("unavailable");return;}
    const report=()=>setStatus(ad.getAttribute("data-ad-status")||"pending");
    const mutation=new MutationObserver(report);mutation.observe(ad,{attributes:true,attributeFilter:["data-ad-status"]});
    const request=()=>{
      if(pushed.current||ad.getBoundingClientRect().width<100||!ad.getClientRects().length)return;
      try{(window.adsbygoogle=window.adsbygoogle||[]).push({});pushed.current=true;}catch{/* Keep the house banner if the ad service is unavailable. */}
    };
    const visibility=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))request();},{rootMargin:"100px"});visibility.observe(ad);
    const resize=new ResizeObserver(()=>{const box=ad.getBoundingClientRect();if(box.bottom>0&&box.top<innerHeight+100)request();});resize.observe(ad);
    return()=>{mutation.disconnect();visibility.disconnect();resize.disconnect();};
  },[slot]);
  return <section className={`rn-ad-placement rn-ad-${placement}`} data-ad-placement={placement} aria-label={c.ad}>
    <div className="rn-ad-label">{c.ad}</div>
    <div className="rn-ad-inventory" data-delivery={status}>
      <ins ref={node} className="adsbygoogle" style={{display:status==="unfilled"?"none":"block",width:"100%"}} data-ad-client={AD_PUBLISHER} data-ad-slot={slot} data-ad-format={placement==="rail"?"vertical":"horizontal"} data-full-width-responsive="false"/>
      {status!=="filled"&&status!=="unfill-optimized"&&<Link className="rn-ad-house" href={`/advertise?placement=${placement}`} tabIndex={status==="pending"?-1:undefined} aria-hidden={status==="pending"||undefined} onClick={()=>trackProductEvent("sponsor_contact_click",{placement,action:"open_advertising"})}>
        <span className="rn-ad-wordmark">RUGBY<b>NOW</b></span>
        <div className="rn-ad-message"><strong>{c.brand}<br/><em>{c.rugby}</em></strong><p>{c.intro}</p></div>
        <img className="rn-ad-ball" src="/icons/rugby-ball.svg" alt="" width={150} height={150}/>
        <span className="rn-ad-cta">{c.cta} <span aria-hidden="true">↗</span></span><small>{c.more}</small>
      </Link>}
    </div>
    <Link className="rn-ad-contact" href="/advertise">{c.contact} ↗</Link>
  </section>;
}
