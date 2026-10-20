"use client";
import {isLiveDataDelayed,preferNewerReading} from "@/lib/liveRefresh";

import {selectFeaturedMatches} from "@/lib/featuredMatches";
import {sourceStatusLabel} from "@/lib/sourceStatusDetail";
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import AdvertisingPlacement from "@/app/components/AdvertisingPlacement";
import CompetitionSidebar from "@/app/components/CompetitionSidebar";
import ExternalWatchOptions from "@/app/components/ExternalWatchOptions";
import BroadcasterLogo from "@/app/components/BroadcasterLogo";
import RugbyBall from "@/app/components/RugbyBall";
import ProgrammeChannels from "@/app/components/ProgrammeChannels";
import BroadcastCountrySelect from "@/app/components/BroadcastCountrySelect";
import {getConfirmedMatchBroadcasts} from "@/lib/matchBroadcasts";
import {broadcastCountryLabel,useBroadcastCountry} from "@/lib/useBroadcastCountry";
import {usePersonalization} from "@/lib/usePersonalization";
import { useEffect, useMemo, useRef, useState } from "react";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
import { agendaCalendar, type AgendaEvent } from "@/lib/agenda";
import { agendaPriority, dailyEntryDate, dailyEntryState, shiftAgendaDate, type DailyAgendaData, type DailyEntry } from "@/lib/dailyAgenda";
import { trackProductEvent } from "@/lib/analytics";
import { buildTimeZoneOptions } from "@/lib/timeZones";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";
import { getDateLocale } from "@/lib/dateLocale";
import { usePrefs, type Lang } from "@/lib/usePrefs";
import { DAILY_COPY } from "./dailyCopy";
import s from "./daily.module.css";


function Glyph({name,filled=false}:{name:"star"|"left"|"right"|"calendar"|"search"|"tv"|"share"|"refresh"|"ball";filled?:boolean}) {
  const paths = {star:"m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z",left:"m14 6-6 6 6 6",right:"m10 6 6 6-6 6",calendar:"M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",search:"m20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",tv:"M8 3l4 4 4-4M3 8h18v12H3Z",share:"M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7",refresh:"M20 7v5h-5M20 12a8 8 0 1 0-2 6",ball:"M4 20C0 6 6 0 20 4c4 14-2 20-16 16Zm3-3L17 7m-7 3 4 4m-2-6 4 4m-8 0 4 4"};
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
function Crest({slug,league=false,name}:{slug?:string;league?:boolean;name:string}) {
  const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[slug]);
  return <span className={s.crest}>{slug && !failed ? <img src={league ? getLeagueLogo(slug) : getTeamLogo(slug)} alt={name} width={28} height={28} onError={()=>setFailed(true)}/> : <Glyph name="ball"/>}</span>;
}
function ProviderMark({id,name}:{id:string;name:string}) {return <BroadcasterLogo id={id} name={name}/>;}
function entryBroadcast(entry:DailyEntry,country:string){
  const confirmed=getConfirmedMatchBroadcasts({competitionSlug:entry.competitionSlug,home:entry.home,away:entry.away,startsAt:entry.startsAt,country});
  return {providers:confirmed?.providers||(country==="AR"?entry.providers:[]),confirmed,pending:confirmed?false:entry.transmissionPending};
}

type AgendaViewContext = {
  c: typeof DAILY_COPY[Lang]; tvCountry:string; timeZone:string; now:number;
  formatDay:(day:string,full?:boolean)=>string; formatTime:(entry:DailyEntry)=>string;
  statusLabel:(entry:DailyEntry)=>string;lang:Lang; isSaved:(entry:DailyEntry)=>boolean;
  toggleSaved:(entry:DailyEntry)=>void; calendar:(entry:DailyEntry)=>void;
  share:(entry:DailyEntry)=>Promise<void>;
};

function Watch({entry,context}:{entry:DailyEntry;context:AgendaViewContext}){
    const {c,tvCountry,calendar,share,lang}=context;
    const {providers,confirmed,pending}=entryBroadcast(entry,tvCountry);
    return <details className={s.watch} onToggle={event=>{if(event.currentTarget.open)trackProductEvent("watch_options_open",{match_id:entry.matchId || entry.id,competition:entry.competitionSlug || "editorial"});}}>
      <summary title={entry.editorial ? `${c.tvGuide} · ${entry.editorial.sourceDate}` : c.tv}><span>{providers.length>0?<><ProviderMark id={providers[0].id} name={providers[0].name}/><b>{providers[0].name}</b>{providers.length>1&&<small>+{providers.length-1}</small>}</>:<><Glyph name="tv"/><span>{c.tvPending}</span></>}</span><span className={s.chevron}>⌄</span></summary>
      <div className={s.watchPanel}><strong>{c.tv} · {broadcastCountryLabel(tvCountry,lang)}</strong>
        {!providers.length?<p>{c.noTv}</p>:<><p>{confirmed?<><a href={confirmed.sourceUrl} target="_blank" rel="noopener noreferrer">{confirmed.sourceName} ↗</a> · {broadcastCountryLabel(tvCountry,lang)}</>:c.guideNote}</p>{providers.map(provider=><div key={provider.id} className={s.provider}><span><ProviderMark id={provider.id} name={provider.name}/><b>{provider.name}</b></span>{provider.href && !pending ? <a href={provider.href} target="_blank" rel="noopener noreferrer" onClick={()=>trackProductEvent("watch_provider_click",{provider_id:provider.id,event_id:entry.id,link_type:provider.linkType || "channel"})}>{provider.linkType==="event"?c.direct:provider.linkType==="platform"?c.platform:c.channel} ↗</a>:<small>{c.tvPending}</small>}</div>)}<p>{c.tvNote}</p></>}
        <ExternalWatchOptions/><div className={s.watchActions}>{entry.startsAt&&<button onClick={()=>calendar(entry)}><Glyph name="calendar"/>{c.calendar}</button>}<button onClick={()=>void share(entry)}><Glyph name="share"/>{c.share}</button></div>
      </div>
    </details>;
  }
function MatchRow({entry,withDate=false,featured=false,context}:{entry:DailyEntry;withDate?:boolean;featured?:boolean;context:AgendaViewContext}){
    const {c,isSaved,toggleSaved,formatDay,formatTime,statusLabel,timeZone,calendar,now,lang}=context;
    const active=["LIVE","HT"].includes(dailyEntryState(entry,now));
    const fixture=<><span className={s.homeTeam}><span>{entry.home}</span><Crest slug={entry.homeSlug} name={entry.home}/></span><strong className={`${s.score} ${active?s.liveScore:""}`}>{entry.homeScore!=null&&entry.awayScore!=null?<>{entry.homeScore}<i>–</i>{entry.awayScore}</>:<i>vs</i>}</strong><span className={s.awayTeam}><Crest slug={entry.awaySlug} name={entry.away || ""}/><span>{entry.away}</span></span></>;
    return <article id={featured?`featured-${entry.id}`:entry.id} className={`${s.matchRow} ${active?s.liveRow:""}`}>
      <button className={`${s.star} ${isSaved(entry)?s.saved:""}`} title={isSaved(entry)?c.unsave:c.save} aria-label={`${isSaved(entry)?c.unsave:c.save}: ${entry.home} ${entry.away || ""}`} aria-pressed={isSaved(entry)} onClick={()=>toggleSaved(entry)}><Glyph name="star" filled={isSaved(entry)}/></button>
      <div className={s.matchTime}>{withDate&&<span className={s.smallDate}>{formatDay(dailyEntryDate(entry,timeZone))}</span>}<time dateTime={entry.startsAt || entry.date}>{formatTime(entry)}</time><span className={active?s.liveState:""} title={dailyEntryState(entry,now)==="pending"?c.noResult:undefined}>{statusLabel(entry)}</span>{isLiveDataDelayed(entry.status,entry.updatedAt,now)&&<small className="rn-live-delayed" title={entry.updatedAt||undefined}>{({es:"Datos demorados",en:"Delayed data",fr:"Données retardées",it:"Dati in ritardo"})[lang]}</small>}</div>
      {entry.matchId&&entry.competitionSlug?<Link className={s.fixture} title={c.details} href={`/matches/${entry.competitionSlug}/${entry.matchId}`} onClick={()=>trackProductEvent("match_open",{match_id:entry.matchId!,competition:entry.competitionSlug!})}>{fixture}</Link>:<div className={s.fixture}>{fixture}</div>}
      <Watch entry={entry} context={context}/>
      <button className={s.calendar} disabled={!entry.startsAt} title={c.calendar} aria-label={`${c.calendar}: ${entry.home} ${entry.away || ""}`} onClick={()=>calendar(entry)}><Glyph name="calendar"/></button>
    </article>;
  }


export default function DailyAgendaClient({initialData,initialDate,explicitDate=false,initialEventId}:{initialData:DailyAgendaData;initialDate:string;explicitDate?:boolean;initialEventId?:string}) {
  const {lang,timeZone,mounted,setTZEverywhere} = usePrefs();
  const c = DAILY_COPY[lang];
  const {prefs}=usePersonalization();
  const locale = getDateLocale(lang);
  const [data,setData] = useState(initialData);
  const [date,setDate] = useState(initialDate);
  const [filter,setFilter] = useState("all");
  const [region,setRegion] = useState("all");
  const [competition,setCompetition] = useState("");
  const [query,setQuery] = useState("");
  const [saved,setSaved] = useState<string[]>([]);
  const {country:tvCountry,setCountry:setTvCountry}=useBroadcastCountry();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const [toast,setToast] = useState("");
  const [now,setNow] = useState(Date.parse(initialData.checkedAt));
  const initialized = useRef(false);
  const request = useRef(0);
  const today = getISODateInTimeZone(new Date(now),timeZone);
  useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    try {const value:unknown=JSON.parse(localStorage.getItem("rn:agenda-saved") || "[]");if(Array.isArray(value))setSaved(value.filter((id):id is string=>typeof id==="string"));}catch{}
  },[]);
  useEffect(()=>{
    if(!mounted)return;
    const keepFocus=initialEventId && new URL(location.href).searchParams.has("event");
    const event = keepFocus ? initialData.entries.find(item=>item.id===initialEventId || item.editorial?.id===initialEventId) : undefined;
    if(event){initialized.current=true;setDate(dailyEntryDate(event,timeZone));return;}
    if(initialized.current)return;
    initialized.current=true;
    if(!explicitDate)setDate(getISODateInTimeZone(new Date(),timeZone));
  },[mounted,timeZone,explicitDate,initialData,initialEventId]);
  useEffect(()=>{
    if(!mounted)return;
    const url = new URL(location.href);url.searchParams.set("date",date);
    history.replaceState(null,"",url);
  },[date,mounted]);
  const livePolling=data.entries.some(e=>(e.status==="LIVE"||e.status==="HT")&&dailyEntryDate(e,timeZone)===date);
  // Background refresh never replaces a failed request with an empty success.
  useEffect(()=>{
    if(!mounted)return;
    const controller = new AbortController();
    const id=++request.current;
    let disposed=false;
    const load = async()=>{
      setBusy(true);setError(false);
      try {
        const response=await fetch(`/api/agenda?date=${date}`,{signal:controller.signal,cache:"no-store"});
        if(!response.ok)throw new Error("Agenda unavailable");
        const result=await response.json() as DailyAgendaData;
        if(!Array.isArray(result.entries))throw new Error("Invalid agenda");
        if(id===request.current && !disposed)setData(previous=>{
          const latest=new Map(previous.entries.filter(entry=>entry.matchId).map(entry=>[entry.matchId,entry]));
          return {...result,entries:result.entries.map(entry=>entry.matchId?preferNewerReading(latest.get(entry.matchId),entry,row=>row.updatedAt):entry)};
        });
      }catch(err){if(!controller.signal.aborted && id===request.current && !disposed)setError(true);}
      finally{if(id===request.current && !disposed)setBusy(false);}
    };
    let timer:ReturnType<typeof setTimeout>;
    let inFlight=false;
    const poll=async()=>{
      if(inFlight||disposed)return;
      clearTimeout(timer);
      inFlight=true;
      if(document.visibilityState!=="hidden")await load();
      inFlight=false;
      if(!disposed)timer=setTimeout(()=>void poll(),livePolling?15000:60000);
    };
    const visible=()=>{if(document.visibilityState!=="hidden")void poll();};
    document.addEventListener("visibilitychange",visible);
    void poll();
    return()=>{disposed=true;controller.abort();clearTimeout(timer);document.removeEventListener("visibilitychange",visible);};
  },[date,refresh,mounted,livePolling]);

  const formatDay=(day:string,full=false)=>new Intl.DateTimeFormat(locale,{weekday:full?"long":"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`));
  const formatTime=(entry:DailyEntry)=>entry.startsAt ? new Intl.DateTimeFormat(locale,{hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone}).format(new Date(entry.startsAt)) : c.unknownTime;
  const isSaved=(entry:DailyEntry)=>saved.includes(entry.id) || !!entry.editorial && saved.includes(entry.editorial.id);
  const matchesFilter=(entry:DailyEntry)=>{
    if(competition && entry.competitionSlug!==competition)return false;
    if(entry.competitionSlug && prefs.hidden.includes(entry.competitionSlug))return false;
    if(filter==="following" && !prefs.leagues.includes(entry.competitionSlug || "") && !prefs.clubs.includes(entry.homeSlug || "") && !prefs.clubs.includes(entry.awaySlug || ""))return false;
    if(region==="pumas" && entry.homeSlug!=="argentina" && entry.awaySlug!=="argentina")return false;
    if(region==="argentina" && entry.region!=="argentina")return false;
    if(region==="international" && entry.region!=="international")return false;
    const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if(query && !normalize(`${entry.home} ${entry.away || ""} ${entry.competition} ${entryBroadcast(entry,tvCountry).providers.map(p=>p.name).join(" ")}`).includes(normalize(query)))return false;
    const state=dailyEntryState(entry,now);
    if(filter==="live" && state!=="LIVE" && state!=="HT")return false;
    if(filter==="upcoming" && state!=="NS")return false;
    if(filter==="finished" && state!=="FT")return false;
    if(filter==="saved" && !isSaved(entry))return false;
    return true;
  };
  const dayMatches=data.entries.filter(entry=>entry.kind==="match" && dailyEntryDate(entry,timeZone)===date);
  const matches=dayMatches.filter(matchesFilter);
  const shows=data.entries.filter(entry=>entry.kind==="show" && dailyEntryDate(entry,timeZone)===date);
  const groups=useMemo(()=>{
    const grouped=new Map<string,DailyEntry[]>();
    for(const entry of matches){const key=entry.competitionSlug || entry.competition;grouped.set(key,[...(grouped.get(key)||[]),entry]);}
    const priority=(entries:DailyEntry[])=>{const rank=prefs.leagues.indexOf(entries[0].competitionSlug || "");return rank<0?1000+Math.min(...entries.map(agendaPriority)):rank;};
    return [...grouped.entries()].sort((a,b)=>priority(a[1])-priority(b[1]) || Math.min(...a[1].map(agendaPriority))-Math.min(...b[1].map(agendaPriority)) || a[1][0].competition.localeCompare(b[1][0].competition));
  },[matches,prefs.leagues]);
  const featured=filter==="all"&&!query&&!competition&&region==="all"?selectFeaturedMatches(data.entries,date,timeZone,now,prefs):[];
  const nextMatches=data.entries.filter(entry=>entry.kind==="match" && dailyEntryDate(entry,timeZone)>date && !featured.some(f=>f.id===entry.id) && matchesFilter(entry)).slice(0,5);
  const recentDay=data.entries.filter(entry=>entry.kind==="match" && entry.status==="FT" && dailyEntryDate(entry,timeZone)<date).map(entry=>dailyEntryDate(entry,timeZone)).sort().at(-1);
  const reset=()=>{setQuery("");setCompetition("");setRegion("all");setFilter("all");};
  function toggleSaved(entry:DailyEntry){
    const next=isSaved(entry) ? saved.filter(id=>id!==entry.id && id!==entry.editorial?.id) : [...saved,entry.id];
    setSaved(next);try{localStorage.setItem("rn:agenda-saved",JSON.stringify(next));}catch{}
    trackProductEvent("agenda_favorite",{event_id:entry.id,saved:next.includes(entry.id)?1:0});
  }
  function shareUrl(entry:DailyEntry){return `${location.origin}/agenda?date=${dailyEntryDate(entry,timeZone)}&event=${encodeURIComponent(entry.id)}#${entry.id}`;}
  function calendar(entry:DailyEntry){
    if(!entry.startsAt)return;
    const event:AgendaEvent={id:entry.id,title:entry.away?`${entry.home} vs ${entry.away}`:entry.home,competition:entry.competition,kind:entry.kind,region:entry.region,startsAt:entry.startsAt,providers:entry.providers,source:entry.editorial?.source || "RugbyNOW",sourceDate:entry.editorial?.sourceDate || entry.date,transmissionPending:entry.transmissionPending};
    const url=URL.createObjectURL(new Blob([agendaCalendar(event,shareUrl(entry))],{type:"text/calendar;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=`${entry.id}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    trackProductEvent("agenda_calendar_export",{event_id:entry.id});
  }
  async function share(entry:DailyEntry){try{await navigator.clipboard.writeText(shareUrl(entry));setToast(c.copied);}catch{setToast(c.copyFailed);}}
  function statusLabel(entry:DailyEntry){const sourceLabel=sourceStatusLabel(entry.sourceUrl,lang);if(sourceLabel)return sourceLabel;const state=dailyEntryState(entry,now);return state==="FT"?c.final:state==="HT"?c.halfTime:state==="LIVE"?`${c.live}${entry.minute ? ` ${entry.minute}′` : ""}`:state==="CANC"?c.cancelled:state==="pending"?c.pending:c.scheduled;}
  function chooseDate(next:string){
    const url=new URL(location.href);url.searchParams.delete("event");url.hash="";
    history.replaceState(null,"",url);setDate(next);
  }
  const view:AgendaViewContext={c,lang,tvCountry,timeZone,now,formatDay,formatTime,statusLabel,isSaved,toggleSaved,calendar,share};
  return <div className={`${s.page} ${prefs.density==="comfortable"?"rn-comfortable":""}`}>
    <SiteHeader/>
    <main className={`${s.main} rn-sports-main`}>
      <div className={s.titleRow}><div><p className={s.eyebrow}>RUGBYNOW / {c.agenda}</p><h1>{c.title}<span className={s.titleDot}>.</span></h1><p>{c.subtitle}</p></div><div className={s.update}><span className={`${s.dot} ${data.source==="snapshot"?s.backupDot:""}`}/><span>{data.source==="snapshot"?c.backup:c.checked}<time dateTime={data.source==="snapshot"?data.snapshotAt:data.checkedAt}>{new Intl.DateTimeFormat(locale,{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone}).format(new Date(data.source==="snapshot"?data.snapshotAt:data.checkedAt))}</time></span><button onClick={()=>setRefresh(value=>value+1)} aria-label={c.retry} disabled={busy}><Glyph name="refresh"/></button></div></div>
      <div className={`${s.layout} rn-sports-grid`}>
        <CompetitionSidebar selected={competition} pumasSelected={region==="pumas"} onSelect={slug=>{setCompetition(competition===slug?"":slug);setRegion("all");}} onPumas={()=>{setRegion(region==="pumas"?"all":"pumas");setCompetition("");}}/>
        <div className={`${s.content} rn-sports-content`}>
          <AdvertisingPlacement placement="leaderboard"/>
          {featured.length>0&&<details className={s.nextBoard} open><summary className={s.sectionTitle}><h2>★ {({es:"Destacados",en:"Ones to watch",fr:"À suivre",it:"Da seguire"})[lang]}</h2><small>{({es:"Tus favoritos y rugby prioritario",en:"Your favourites and priority rugby",fr:"Vos favoris et rugby prioritaire",it:"I tuoi preferiti e rugby prioritario"})[lang]} ⌄</small></summary>{featured.map(entry=><MatchRow key={`featured-${entry.id}`} entry={entry} withDate featured context={view}/>)}</details>}
          <section className={s.board} aria-label={c.agenda}>
            <div className={s.dateBar}><button className={s.dayArrow} aria-label={c.previous} onClick={()=>chooseDate(shiftAgendaDate(date,-1))}><Glyph name="left"/></button><div className={s.selectedDate}><strong>{date===today?`${c.today} · `:""}{formatDay(date,true)}</strong><label title={c.chooseDate}><Glyph name="calendar"/><input type="date" value={date} aria-label={c.chooseDate} onClick={event=>{try{event.currentTarget.showPicker?.();}catch{event.currentTarget.focus();}}} onChange={event=>{if(event.target.value)chooseDate(event.target.value);}}/></label></div><button className={s.dayArrow} aria-label={c.next} onClick={()=>chooseDate(shiftAgendaDate(date,1))}><Glyph name="right"/></button></div>
            <div className={s.quickDates}>{[[-1,c.yesterday],[0,c.today],[1,c.tomorrow]].map(([offset,label])=><button key={offset} className={date===shiftAgendaDate(today,Number(offset))?s.activeQuick:""} onClick={()=>chooseDate(shiftAgendaDate(today,Number(offset)))}>{label}</button>)}<label className={s.zone}><span>{c.timeZone}</span><select aria-label={c.timeZone} value={timeZone} onChange={event=>setTZEverywhere(event.target.value)}>{buildTimeZoneOptions(timeZone).map(option=><option key={option.value} value={option.value}>{option.long}</option>)}</select></label></div>
            <div className={s.filters}><div className={s.statusTabs}>{[["all",c.all],["live",c.live],["upcoming",c.upcoming],["finished",c.finished],["saved",c.saved],["following",lang==="es"?"Siguiendo":lang==="fr"?"Suivis":lang==="it"?"Seguiti":"Following"]].map(([value,label])=><button key={value} aria-pressed={filter===value} className={filter===value?s.activeTab:""} onClick={()=>setFilter(value)}>{value==="live"&&<span className={s.liveDot}/>}{value==="saved"&&<Glyph name="star"/>}{label}{value==="live"&&<small>{dayMatches.filter(entry=>["LIVE","HT"].includes(dailyEntryState(entry,now))).length}</small>}</button>)}</div><label className={s.search}><Glyph name="search"/><input type="search" value={query} placeholder={c.search} aria-label={c.search} onChange={event=>setQuery(event.target.value)}/></label></div>
            <div className={s.minorFilters}><label><span className={s.srOnly}>{c.allRegions}</span><select aria-label={c.allRegions} value={region} onChange={event=>{setRegion(event.target.value);setCompetition("");}}><option value="all">{c.allRegions}</option><option value="argentina">{c.argentina}</option><option value="international">{c.international}</option><option value="pumas">Los Pumas</option></select></label><span>{matches.length} {matches.length===1?c.match:c.matches}{busy&&<small className={s.loading} role="status"><RugbyBall spinning small/>{c.loading}</small>}</span><BroadcastCountrySelect value={tvCountry} onChange={setTvCountry}/></div>
            {error&&<div className={s.error} role="alert">{c.error}<button onClick={()=>setRefresh(value=>value+1)}>{c.retry}</button></div>}
            <div className={s.tableLabels}><span/><span>{c.time}</span><span>{c.teams}</span><span>{c.tv}</span><span/></div>
            {groups.length?groups.map(([key,entries])=><section key={key} className={s.competition}><div className={s.competitionHeading}><Crest slug={entries[0].competitionSlug} league name={entries[0].competition}/><h2>{entries[0].competitionSlug?<Link href={`/leagues/${entries[0].competitionSlug}`}>{entries[0].competition}</Link>:entries[0].competition}</h2><small>{entries.length}</small></div>{entries.map(entry=><MatchRow key={entry.id} entry={entry} context={view}/>)}</section>):<div className={s.empty}><RugbyBall spinning={busy}/><strong>{dayMatches.length || filter!=="all" || query || competition || region!=="all"?c.filteredEmpty:c.empty}</strong><p>{c.emptyHint}</p>{!dayMatches.length&&<Link className="rn-empty-challenge" href="/games">{({es:"Un desafío de rugby mientras tanto →",en:"Try a rugby challenge meanwhile →",fr:"Un défi rugby en attendant →",it:"Una sfida di rugby nel frattempo →"})[lang]}</Link>}<div>{(filter!=="all"||query||competition||region!=="all")&&<button onClick={reset}>{c.reset}</button>}{recentDay&&<button onClick={()=>{reset();chooseDate(recentDay);}}>{c.recent} · {formatDay(recentDay)} →</button>}</div></div>}
          </section>
          {!matches.length&&nextMatches.length>0&&<section className={s.nextBoard}><div className={s.sectionTitle}><h2>{c.nextMatches}</h2><button onClick={()=>chooseDate(dailyEntryDate(nextMatches[0],timeZone))}>{c.showAgenda} →</button></div>{nextMatches.map(entry=><MatchRow key={entry.id} entry={entry} withDate context={view}/>)}</section>}
          {prefs.guides&&shows.length>0&&<details className={s.programmes}><summary><Glyph name="tv"/><strong>{c.programmes}</strong><span>{shows.length}</span><small>{c.editorial} · 15–22 OCT</small><span>⌄</span></summary><div className={s.programmeList}>{shows.map(entry=><article key={entry.id} id={entry.id} className={s.showRow}><time dateTime={entry.startsAt!}>{formatTime(entry)}</time><div><strong>{entry.home}</strong><span>{entry.competition}</span></div><ProgrammeChannels providers={entry.providers} eventId={entry.id} lang={lang}/><button title={c.calendar} aria-label={`${c.calendar}: ${entry.home}`} onClick={()=>calendar(entry)}><Glyph name="calendar"/></button></article>)}</div><p className={s.programmeNote}>{c.guideNote}</p></details>}
          <p className={s.coverage}>{c.coverage}</p>
          <footer className={s.footer}><b>RUGBYNOW</b><Link href="/about">{c.about}</Link><Link href="/privacy">{c.privacy}</Link><a href={`mailto:lopresttivito@gmail.com?subject=RugbyNOW%20${encodeURIComponent(date)}`}>{c.contact}</a></footer>
        </div>
        <aside className="rn-ad-rail"><AdvertisingPlacement placement="rail"/></aside>
      </div>
      {toast&&<div role="status" className={s.toast}>{toast}<button aria-label={c.close} onClick={()=>setToast("")}>×</button></div>}
    </main>
  </div>;
}
