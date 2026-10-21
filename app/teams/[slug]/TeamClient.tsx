"use client";
import PendingCalendar from "@/app/components/PendingCalendar";
import type {PendingProD2Fixture} from "@/lib/proD2CalendarData";
import {sourceStatusLabel} from "@/lib/sourceStatusDetail";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import PortalShell from "@/app/components/PortalShell";
import TeamSquads from "@/app/components/TeamSquads";
import PlayerUpdates from "@/app/components/PlayerUpdates";
import MatchBroadcastLink from "@/app/components/MatchBroadcastLink";
import BroadcastCountrySelect from "@/app/components/BroadcastCountrySelect";
import RecentForm from "@/app/components/RecentForm";
import {useBroadcastCountry} from "@/lib/useBroadcastCountry";
import {usePrefs} from "@/lib/usePrefs";
import {usePersonalization} from "@/lib/usePersonalization";
import {toggleSlug} from "@/lib/competitionPrefs";
import {getTeamLogo,getLeagueLogo} from "@/lib/assets";
import {getProD2Team} from "@/lib/proD2";
import {t} from "@/lib/i18n";
import ClubInformation, {type ClubStaff} from "@/app/components/ClubInformation";
import type {ClubInformation as Institution} from "@/lib/clubInformation";
import type {TeamSquad} from "@/lib/squads";
import type {PlayerUpdate} from "@/lib/playerUpdates";
import s from "@/app/agenda/daily.module.css";
type MatchStatus="NS"|"LIVE"|"HT"|"FT"|"CANC";
export type TeamPayload = {
  discipline: {selected:string;available:string[]};
  squads: TeamSquad[];
  institution: Institution|null;
  staff: ClubStaff|null;
  pendingFixtures: PendingProD2Fixture[];
  playerUpdates: PlayerUpdate[];
  positions: {competitionSlug:string;season:string;position:number;pts:number;sourceUrl:string;checkedAt:string}[];
  team: { id: number; name: string; slug: string | null };
  profile: {
    slug: string;
    displayName?: string;
    country?: string;
    city?: string;
    venue?: string;
    founded?: string;
    summary?: string;
    history?: string;
    colors?: string[];
  };
  countryProfile?: {
    key: string;
    name: string;
    summary: string;
    rugbyContext: string;
  } | null;
  stats: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    pointsFor: number;
    pointsAgainst: number;
    winRate: number;
    form: Array<"W" | "D" | "L">;
  };
  competitions: Array<{
    slug: string;
    name: string;
    region: string | null;
    seasons: string[];
  }>;
  recentMatches: Array<{
    source_url?:string|null;
    id: number;
    match_date: string;
    kickoff_time: string | null;
    status: MatchStatus;
    minute: number | null;
    home_score: number | null;
    away_score: number | null;
    home_team: { id: number; name: string; slug: string | null } | null;
    away_team: { id: number; name: string; slug: string | null } | null;
    competition: { name: string; slug: string; region: string | null } | null;
  }>;
  upcomingMatches: Array<{
    source_url?:string|null;
    id: number;
    match_date: string;
    kickoff_time: string | null;
    status: MatchStatus;
    minute: number | null;
    home_score: number | null;
    away_score: number | null;
    home_team: { id: number; name: string; slug: string | null } | null;
    away_team: { id: number; name: string; slug: string | null } | null;
    competition: { name: string; slug: string; region: string | null } | null;
  }>;
};

export default function TeamClient({slug,initialData=null}:{slug:string;initialData?:TeamPayload|null}){
 const searchParams=useSearchParams();const discipline=searchParams?.get("discipline")||"";
 const {lang,timeZone}=usePrefs();const {prefs,update}=usePersonalization();const {country,setCountry}=useBroadcastCountry(getProD2Team(slug)?"FR":"AR");
 const [data,setData]=useState<TeamPayload|null>(initialData),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const c={es:["Seguir club","Siguiendo","Últimos resultados","Próximos partidos","Datos del equipo","Resumen de los partidos disponibles","No hay encuentros disponibles.","No se pudo cargar la ficha.","Reintentar","Partidos","Ganados","Empatados","Perdidos","Puntos a favor / en contra","Competiciones"],en:["Follow team","Following","Recent results","Upcoming matches","Team information","Summary of available matches","No available matches.","Could not load this team.","Retry","Played","Won","Drawn","Lost","Points for / against","Competitions"],fr:["Suivre le club","Suivi","Derniers résultats","Prochains matchs","Informations du club","Résumé des matchs disponibles","Aucun match disponible.","Impossible de charger la fiche.","Réessayer","Joués","Victoires","Nuls","Défaites","Points pour / contre","Compétitions"],it:["Segui club","Seguito","Ultimi risultati","Prossime partite","Informazioni squadra","Riepilogo delle partite disponibili","Nessuna partita disponibile.","Impossibile caricare la squadra.","Riprova","Giocate","Vinte","Pareggiate","Perse","Punti fatti / subiti","Competizioni"]}[lang];
 useEffect(()=>{const controller=new AbortController();void(async()=>{try{const r=await fetch(`/api/teams/${encodeURIComponent(slug)}?discipline=${encodeURIComponent(discipline)}`,{signal:controller.signal,cache:"no-store"});if(!r.ok)throw Error();const body=await r.json();if(!body.team)throw Error();setData(body);setError(false);}catch{if(!controller.signal.aborted)setError(true);}})();return()=>controller.abort();},[slug,retry,discipline]);
 const title=data?.profile.displayName||data?.team.name||t(lang,"teamLabel");
 function fixture(m:TeamPayload["recentMatches"][number]){
  const start=m.kickoff_time?new Date(`${m.match_date}T${m.kickoff_time}Z`):null;
  return <article className={`${s.matchRow} rn-league-match`} key={m.id}><div className={s.matchTime}><span>{new Intl.DateTimeFormat(lang,{day:"numeric",month:"short",year:"numeric",timeZone:start?timeZone:"UTC"}).format(start||new Date(`${m.match_date}T12:00:00Z`))}</span><time>{start?new Intl.DateTimeFormat(lang,{hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone}).format(start):m.status==="FT"?"—":t(lang,"tbd")}</time><small>{sourceStatusLabel(m.source_url,lang)||(m.status==="FT"?({es:"Final",en:"Final",fr:"Terminé",it:"Finale"})[lang]:m.status==="CANC"?t(lang,"cancelled"):m.status==="LIVE"||m.status==="HT"?t(lang,"live"):start&&start.getTime()<Date.now()?({es:"Resultado pendiente",en:"Result pending",fr:"Résultat en attente",it:"Risultato in attesa"})[lang]:({es:"Programado",en:"Scheduled",fr:"Programmé",it:"In programma"})[lang])}</small></div><Link className={s.fixture} href={`/matches/${m.competition?.slug}/${m.id}`}><span className={s.homeTeam}><span>{m.home_team?.name||"—"}</span><span className={s.crest}><img src={getTeamLogo(m.home_team?.slug)} alt="" width={26} height={26}/></span></span><strong className={s.score}>{m.home_score!==null&&m.away_score!==null?<>{m.home_score}<i>–</i>{m.away_score}</>:<i>vs</i>}</strong><span className={s.awayTeam}><span className={s.crest}><img src={getTeamLogo(m.away_team?.slug)} alt="" width={26} height={26}/></span><span>{m.away_team?.name||"—"}</span></span></Link><MatchBroadcastLink guideHref={`/agenda?date=${m.match_date}&event=match-${m.id}#match-${m.id}`} matchId={m.id} query={{competitionSlug:m.competition?.slug,home:m.home_team?.name,away:m.away_team?.name,startsAt:start?.toISOString(),country}}/></article>;
 }
 return <PortalShell title={title} subtitle={[data?.profile.city,data?.profile.country].filter(Boolean).join(" · ")}>
 {error&&<p role="alert" className="rn-notice">{c[7]} <button onClick={()=>setRetry(n=>n+1)}>{c[8]}</button></p>}
 {!data?<p>{!error&&t(lang,"loading")}</p>:<>
 {data.discipline?.available.length>1&&<nav className="rn-league-tools" aria-label="Rugby"><span>Rugby:</span>{data.discipline.available.map(value=><Link key={value} aria-current={value===data.discipline.selected?"page":undefined} href={`/teams/${slug}?discipline=${value}`}>{value==="rugby-sevens"?"Seven":value==="rugby-union"?"XV":"League"}{value===data.discipline.selected?" ✓":""}</Link>)}</nav>}
 <div className="rn-league-tools"><img src={getTeamLogo(slug)} alt="" width={46} height={46}/><button aria-pressed={prefs.clubs.includes(slug)} onClick={()=>update({clubs:toggleSlug(prefs.clubs,slug)})}>★ {prefs.clubs.includes(slug)?c[1]:c[0]}</button><RecentForm form={data.stats.form} lang={lang}/><BroadcastCountrySelect value={country} onChange={setCountry}/></div>
 {!!data.positions?.length&&<div className="rn-team-positions">{data.positions.map(p=><p key={`${p.competitionSlug}:${p.season}`}><Link href={`/leagues/${p.competitionSlug}?season=${encodeURIComponent(p.season)}`}>#{p.position} · {p.pts} pts · {p.season} →</Link> <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">↗</a></p>)}</div>}
 <section className={s.nextBoard}><div className={s.sectionTitle}><h2>{c[2]}</h2></div>{data.recentMatches.length?data.recentMatches.map(fixture):<p className="rn-notice">{c[6]}</p>}</section>
 <section className={s.nextBoard}><div className={s.sectionTitle}><h2>{c[3]}</h2></div>{data.upcomingMatches.length?data.upcomingMatches.map(fixture):<p className="rn-notice">{c[6]}</p>}</section>
 {!!data.pendingFixtures?.length&&<PendingCalendar fixtures={data.pendingFixtures}/>}
 <ClubInformation institution={data.institution||null} staff={data.staff||null}/><TeamSquads squads={data.squads||[]}/><PlayerUpdates updates={data.playerUpdates||[]}/>
 <details className="rn-panel"><summary><strong>{c[4]}</strong> ⌄</summary><p>{data.profile.summary}</p><dl className="rn-player-facts">{[[t(lang,"venue"),data.profile.venue],[t(lang,"founded"),data.profile.founded],[t(lang,"city"),data.profile.city],[t(lang,"country"),data.profile.country],[t(lang,"colors"),data.profile.colors?.join(", ")]].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{data.profile.history&&<p>{data.profile.history}</p>}{data.countryProfile&&<><h3>{data.countryProfile.name}</h3><p>{data.countryProfile.summary}</p><p>{data.countryProfile.rugbyContext}</p></>}</details>
 <details className="rn-panel"><summary><strong>{c[5]}</strong> ⌄</summary><dl className="rn-player-facts">{[[c[9],data.stats.played],[c[10],data.stats.won],[c[11],data.stats.drawn],[c[12],data.stats.lost],[c[13],`${data.stats.pointsFor} / ${data.stats.pointsAgainst}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
 <section className="rn-panel"><h2>{c[14]}</h2>{data.competitions.map(comp=><div className="rn-directory-row" key={comp.slug}><img src={getLeagueLogo(comp.slug)} alt="" width={24} height={24}/><div><Link href={`/leagues/${comp.slug}`}>{comp.name} →</Link><small>{comp.region} · {comp.seasons.join(", ")}</small></div></div>)}</section>
 </>}
 </PortalShell>;
}
