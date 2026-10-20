"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {getLeagueLogo,getTeamLogo} from "@/lib/assets";
import {usePrefs} from "@/lib/usePrefs";
import {usePersonalization} from "@/lib/usePersonalization";
import {toggleSlug} from "@/lib/competitionPrefs";

type Competition={slug:string;name:string;country_code?:string|null;region?:string|null};
const initial:Competition[]=[{slug:"ar-urba-top14",name:"URBA Top 14"},{slug:"sra",name:"Super Rugby Américas"},{slug:"int-six-nations",name:"Six Nations"},{slug:"int-united-rugby-championship",name:"United Rugby Championship"},{slug:"fr-top14",name:"Top 14 · France"},{slug:"fr-pro-d2",name:"Pro D2 · France"},{slug:"en-premiership-rugby",name:"Premiership"},{slug:"int-super-rugby-pacific",name:"Super Rugby Pacific"},{slug:"eu-champions-cup",name:"Champions Cup"},{slug:"int-world-cup",name:"Rugby World Cup"}];
const copy={es:{today:"Hoy",title:"Competiciones",featured:"Destacadas",argentina:"Argentina",international:"Internacional",europe:"Europa",america:"América",all:"Todas las competiciones",settings:"Personalizar mi agenda",follow:"Seguir liga",unfollow:"Dejar de seguir liga"},en:{today:"Today",title:"Competitions",featured:"Featured",argentina:"Argentina",international:"International",europe:"Europe",america:"Americas",all:"All competitions",settings:"Customize my schedule",follow:"Follow league",unfollow:"Unfollow league"},fr:{today:"Aujourd’hui",title:"Compétitions",featured:"À la une",argentina:"Argentine",international:"International",europe:"Europe",america:"Amériques",all:"Toutes les compétitions",settings:"Personnaliser mon agenda",follow:"Suivre la ligue",unfollow:"Ne plus suivre"},it:{today:"Oggi",title:"Competizioni",featured:"In evidenza",argentina:"Argentina",international:"Internazionale",europe:"Europa",america:"Americhe",all:"Tutte le competizioni",settings:"Personalizza l’agenda",follow:"Segui la lega",unfollow:"Non seguire più"}};
function group(c:Competition){if(c.slug.startsWith("ar-")||c.slug==="sra")return "argentina";if(/^(fr-|it-|en-|eu-)/.test(c.slug)||c.slug==="int-united-rugby-championship")return "europe";if(c.country_code==="US")return "america";return "international";}

export default function CompetitionSidebar({selected,onSelect,onPumas,pumasSelected=false}:{selected?:string;onSelect?:(slug:string)=>void;onPumas?:()=>void;pumasSelected?:boolean}){
  const {lang}=usePrefs();const c=copy[lang];const path=usePathname();const {prefs,update}=usePersonalization();const [leagues,setLeagues]=useState(initial);
  useEffect(()=>{const controller=new AbortController();fetch("/api/preferences-catalog",{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(Array.isArray(data.leagues)&&data.leagues.length)setLeagues(data.leagues);}).catch(()=>{});return()=>controller.abort();},[]);
  const visible=leagues.filter(l=>!prefs.hidden.includes(l.slug));
  const featured=prefs.leagues.length?prefs.leagues.map(slug=>visible.find(l=>l.slug===slug)).filter((l):l is Competition=>Boolean(l)):initial.filter(l=>visible.some(item=>item.slug===l.slug)).slice(0,5);
  const row=(league:Competition)=>{const active=selected===league.slug||path===`/leagues/${league.slug}`;return <div className={`rn-nav-league ${active?"rn-nav-current":""}`} key={league.slug}>
    {onSelect?<button type="button" onClick={()=>onSelect(league.slug)}><img src={getLeagueLogo(league.slug)} alt="" width={20} height={20}/><span>{league.name}</span></button>:<Link href={`/leagues/${league.slug}`}><img src={getLeagueLogo(league.slug)} alt="" width={20} height={20}/><span>{league.name}</span></Link>}
    {onSelect&&<Link className="rn-nav-open" href={`/leagues/${league.slug}`} aria-label={`${c.title}: ${league.name}`}>›</Link>}
    <button type="button" className={prefs.leagues.includes(league.slug)?"rn-nav-star rn-is-followed":"rn-nav-star"} aria-label={`${prefs.leagues.includes(league.slug)?c.unfollow:c.follow}: ${league.name}`} aria-pressed={prefs.leagues.includes(league.slug)} onClick={()=>update({leagues:toggleSlug(prefs.leagues,league.slug)})}>★</button>
  </div>;};
  return <aside className="rn-competition-sidebar" aria-label={c.title}>
    <Link href="/" className={`rn-sidebar-today ${path==="/"||path==="/agenda"?"rn-nav-current":""}`}><span aria-hidden="true">◉</span>{c.today}</Link>
    <div className="rn-sidebar-heading">{c.title}<small>{leagues.length}</small></div>
    <details open className="rn-nav-group"><summary><span>★ {c.featured}</span><small>{featured.length}</small></summary><div>
      <div className={`rn-nav-league ${pumasSelected?"rn-nav-current":""}`}>{onPumas?<button type="button" onClick={onPumas}><img src={getTeamLogo("argentina")} alt="" width={20} height={20}/><span>Los Pumas</span></button>:<Link href="/teams/argentina"><img src={getTeamLogo("argentina")} alt="" width={20} height={20}/><span>Los Pumas</span></Link>}</div>{featured.map(row)}
    </div></details>
    {(["argentina","international","europe","america"] as const).map(key=>{const list=visible.filter(l=>group(l)===key);return list.length?<details key={key} open={key==="argentina"||key==="international"} className="rn-nav-group"><summary><span>{key==="argentina"?"🇦🇷":key==="europe"?"🇪🇺":key==="america"?"🌎":"🌐"} {c[key]}</span><small>{list.length}</small></summary><div>{list.map(row)}</div></details>:null;})}
    <Link className="rn-sidebar-all" href="/leagues">{c.all} →</Link><Link className="rn-sidebar-config" href="/settings">⚙ {c.settings}</Link>
  </aside>;
}
