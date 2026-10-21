"use client";
import {useState} from "react";
import Link from "next/link";
import {usePrefs} from "@/lib/usePrefs";
import {getTeamLogo} from "@/lib/assets";
import type {PendingProD2Fixture} from "@/lib/proD2CalendarData";
export default function PendingCalendar({fixtures,compact=false}:{fixtures:PendingProD2Fixture[];compact?:boolean}){
 const {lang}=usePrefs();const rounds=[...new Set(fixtures.map(m=>m.round))];const [selected,setSelected]=useState(rounds[0]);
 if(!fixtures.length)return null;
 const c={es:["Fechas por confirmar","Los cruces están publicados. La LNR todavía no confirmó el día y la hora de estos partidos dentro de cada ventana.","Fecha","Día y hora a confirmar"],en:["Dates to be confirmed","Fixtures are published. LNR has not yet confirmed the day and kickoff within each round window.","Round","Day and time TBC"],fr:["Dates à confirmer","Affiches publiées. La LNR n’a pas encore confirmé le jour et l’heure de ces matchs dans chaque période.","Journée","Jour et horaire à confirmer"],it:["Date da confermare","Gli incontri sono pubblicati. La LNR non ha ancora confermato giorno e orario all’interno di ogni finestra.","Giornata","Giorno e ora da confermare"]}[lang];
 const date=(value:string)=>new Intl.DateTimeFormat(lang,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
 const content=<><p className="rn-table-source">{c[1]}</p>{!compact&&<label className="rn-round-select">{c[2]} <select aria-label={c[2]} value={selected} onChange={e=>setSelected(Number(e.target.value))}>{rounds.map(r=><option key={r} value={r}>{r}</option>)}</select></label>}{fixtures.filter(m=>compact||m.round===selected).map(m=><article key={m.sourceId} className="rn-pending-fixture"><div><small>{c[2]} {m.round}</small><time>{date(m.windowFrom)} – {date(m.windowTo)}</time><small>{c[3]}</small></div><Link href={`/matches/${m.competitionSlug}/${m.id}`}><span><img src={getTeamLogo(m.homeSlug)} alt="" width={24} height={24}/>{m.home}</span><b>vs</b><span><img src={getTeamLogo(m.awaySlug)} alt="" width={24} height={24}/>{m.away}</span></Link><a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`LNR: ${m.home} vs ${m.away}`}>LNR ↗</a></article>)}</>;
 return compact?<section className="rn-panel">{content}</section>:<details className="rn-panel"><summary><strong>{c[0]}</strong> <small>({fixtures.length}) ⌄</small></summary>{content}</details>;
}
