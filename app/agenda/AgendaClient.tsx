"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import { AGENDA_SOURCE, EDITORIAL_AGENDA } from "@/data/rugbyAgenda";
import { agendaCalendar, agendaDate, filterAgenda, type AgendaEvent } from "@/lib/agenda";
import { trackProductEvent } from "@/lib/analytics";
import { getDateLocale } from "@/lib/dateLocale";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";
import { usePrefs } from "@/lib/usePrefs";
import { COPY } from "./copy";
import s from "./agenda.module.css";

function Icon({ name, filled = false }: { name: "star" | "arrow" | "search" | "calendar" | "share" | "tv"; filled?: boolean }) {
  const paths = { star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z", arrow: "M7 17 17 7M7 7h10v10", search: "m20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z", calendar: "M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z", share: "M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7", tv: "M8 3l4 4 4-4M3 8h18v13H3Z" };
  return <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function AgendaClient({ initialDate, initialEventId }: { initialDate: string; initialEventId?: string }) {
  const { lang, timeZone, mounted } = usePrefs();
  const copy = COPY[lang];
  const locale = getDateLocale(lang);
  const [date, setDate] = useState(initialDate);
  const [kind, setKind] = useState("all");
  const [region, setRegion] = useState("all");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [message, setMessage] = useState("");
  const today = getISODateInTimeZone(new Date(), timeZone);

  useEffect(() => {
    const event = EDITORIAL_AGENDA.find((item) => item.id === initialEventId);
    if (event && mounted) setDate(agendaDate(event, timeZone));
  }, [initialEventId, mounted, timeZone]);

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("rn:agenda-saved") || "[]");
      if (Array.isArray(value)) setSaved(value.filter((id): id is string => typeof id === "string"));
    } catch { /* A malformed browser preference must not block the agenda. */ }
  }, []);

  const events = useMemo(() => filterAgenda(EDITORIAL_AGENDA, { date, kind, region, query, saved: onlySaved ? new Set(saved) : undefined, timeZone }), [date, kind, region, query, onlySaved, saved, timeZone]);
  const days = useMemo(() => [...new Set(EDITORIAL_AGENDA.map((event) => agendaDate(event, timeZone)))].sort(), [timeZone]);
  const groups = useMemo(() => {
    const result = new Map<string, AgendaEvent[]>();
    for (const event of events) { const day = agendaDate(event, timeZone); result.set(day, [...(result.get(day) || []), event]); }
    return [...result.entries()];
  }, [events, timeZone]);
  const regionName = (value: string) => value === "buenos-aires" ? copy.buenosAires : value === "international" ? copy.international : copy.argentina;
  const formatDay = (value: string, full = false) => new Intl.DateTimeFormat(locale, { weekday: full ? "long" : "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
  const clearFilters = () => { setDate(""); setQuery(""); setRegion("all"); setKind("all"); setOnlySaved(false); };

  function toggleSaved(event: AgendaEvent) {
    const next = saved.includes(event.id) ? saved.filter((id) => id !== event.id) : [...saved, event.id];
    setSaved(next);
    try { localStorage.setItem("rn:agenda-saved", JSON.stringify(next)); } catch { /* Browser may disallow persistent preferences. */ }
    trackProductEvent("agenda_favorite", { event_id: event.id, saved: next.includes(event.id) ? 1 : 0 });
  }
  function eventUrl(event: AgendaEvent) {
    return `${location.origin}/agenda?event=${encodeURIComponent(event.id)}#${event.id}`;
  }
  function downloadCalendar(event: AgendaEvent) {
    const url = URL.createObjectURL(new Blob([agendaCalendar(event, eventUrl(event))], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${event.id}.ics`; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    trackProductEvent("agenda_calendar_export", { event_id: event.id });
  }
  async function shareEvent(event: AgendaEvent) {
    try { await navigator.clipboard.writeText(eventUrl(event)); setMessage(copy.copied); }
    catch { setMessage(copy.copyFailed); }
  }

  return <div className={s.page}>
    <AppHeader />
    <main className={s.main}>
      <nav className={s.breadcrumb} aria-label="Rugby Now"><Link href="/">RUGBY NOW</Link><span>/</span><span>{copy.agenda}</span><Link className={s.scoreLink} href="/">{copy.scores} <Icon name="arrow" /></Link></nav>
      <section className={s.hero}>
        <div><p className={s.kicker}><span />{copy.kicker}</p><h1>{copy.title}</h1><p className={s.description}>{copy.description}</p></div>
        <div className={s.edition}><span>{copy.edition}</span><strong>15 — 22<span> OCT 2026</span></strong><p>{copy.source}<br /><b>Norte Rugby</b></p></div>
      </section>

      <div className={s.toolbar}>
        <label className={s.search}><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.searchLabel} /></label>
        <button className={`${s.savedButton} ${onlySaved ? s.selected : ""}`} aria-pressed={onlySaved} onClick={() => { setOnlySaved(!onlySaved); setDate(""); }}><Icon name="star" filled={onlySaved} />{copy.saved}<span>{saved.length}</span></button>
      </div>

      <div className={s.layout}>
        <section className={s.schedule} aria-label={copy.agenda}>
          <div className={s.filters}>
            <div className={s.tabs}>
              {[["all", copy.all], ["match", copy.match], ["show", copy.show]].map(([value, label]) => <button key={value} onClick={() => setKind(value)} className={kind === value ? s.activeTab : ""} aria-pressed={kind === value}>{label}</button>)}
            </div>
            <label className={s.region}><span className={s.srOnly}>{copy.region}</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">{copy.allRegions}</option><option value="buenos-aires">{copy.buenosAires}</option><option value="argentina">{copy.argentina}</option><option value="international">{copy.international}</option></select></label>
          </div>
          <div className={s.dateStrip}>
            <button className={date === today ? s.activeDate : ""} onClick={() => setDate(today)}>{copy.today}<strong>{new Intl.DateTimeFormat(locale, {day:"2-digit",month:"short",timeZone}).format(new Date())}</strong></button>
            <button className={!date ? s.activeDate : ""} onClick={() => setDate("")}>{copy.guide}<strong>15–22 OCT</strong></button>
            {days.filter((day) => day !== today).map((day) => <button key={day} className={date === day ? s.activeDate : ""} onClick={() => setDate(day)}>{formatDay(day).split(" ")[0]}<strong>{formatDay(day).replace(/^\S+\s*/, "")}</strong></button>)}
            <label className={s.dateInput}><Icon name="calendar" /><span className={s.srOnly}>{copy.date}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label={copy.date} /></label>
          </div>
          <div className={s.listSummary}><span><b>{events.length}</b> {events.length === 1 ? copy.event : copy.events}</span><span>{copy.hours} <b>{timeZone.replace(/_/g, " ")}</b></span></div>

          {groups.length === 0 ? <div className={s.empty}><Icon name={onlySaved ? "star" : "calendar"} /><h2>{onlySaved ? copy.noSaved : copy.noEvents}</h2><p>{copy.savedHint}</p><button onClick={clearFilters}>{copy.reset}</button></div> : groups.map(([day, dayEvents]) => <section key={day} className={s.dayGroup}>
            <div className={s.dayHeading}><h2>{formatDay(day, true)}</h2><span>{dayEvents.length} {dayEvents.length === 1 ? copy.event : copy.events}</span></div>
            {dayEvents.map((event) => {
              const isSaved = saved.includes(event.id);
              const past = mounted && new Date(event.startsAt).getTime() < Date.now();
              return <article id={event.id} key={event.id} className={s.event}>
                <div className={s.time}><time dateTime={event.startsAt}>{new Intl.DateTimeFormat(locale, {timeZone, hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).format(new Date(event.startsAt))}</time><span>{past ? copy.past : copy.upcoming}</span></div>
                <div className={s.eventInfo}><div className={s.eventMeta}><span className={event.kind === "show" ? s.showTag : s.matchTag}>{event.kind === "show" ? copy.show : copy.match}</span><span>{regionName(event.region)}</span></div><h3>{event.title}</h3><p>{event.competition}</p>{event.transmissionPending && <span className={s.pending}>{copy.broadcastPending}</span>}</div>
                <div className={s.providers}>{event.providers.map((provider) => <div key={provider.id} className={s.provider}>
                  <span>{provider.name}</span>{provider.href ? <a href={provider.href} target="_blank" rel="noopener noreferrer" onClick={() => trackProductEvent("watch_provider_click", {provider_id:provider.id,event_id:event.id,link_type:provider.linkType || "channel"})}>{provider.linkType === "event" ? copy.direct : provider.linkType === "platform" ? copy.platform : copy.channel}<Icon name="arrow" /></a> : <span className={s.linkPending}>{copy.pending}</span>}
                </div>)}</div>
                <div className={s.eventActions}><button aria-label={`${isSaved ? copy.unsave : copy.save}: ${event.title}`} title={isSaved ? copy.unsave : copy.save} aria-pressed={isSaved} className={isSaved ? s.isSaved : ""} onClick={() => toggleSaved(event)}><Icon name="star" filled={isSaved} /></button><button aria-label={`${copy.calendar}: ${event.title}`} title={copy.calendar} onClick={() => downloadCalendar(event)}><Icon name="calendar" /></button><button aria-label={`${copy.share}: ${event.title}`} title={copy.share} onClick={() => shareEvent(event)}><Icon name="share" /></button></div>
              </article>;
            })}
          </section>)}
          <div className={s.provenance}><p><strong>{copy.sourceDate}: {formatDay(AGENDA_SOURCE.date)}.</strong> {copy.sourceNote}</p><p>{copy.territory} {copy.linkNote}</p><a href={`mailto:lopresttivito@gmail.com?subject=${encodeURIComponent(copy.reportSubject)}&body=${encodeURIComponent(`${copy.reportBody}\n${date || AGENDA_SOURCE.from}\n`)}`}>{copy.report} <Icon name="arrow" /></a></div>
        </section>

        <aside className={s.sidebar}>
          <div className={s.featureCard}><span className={s.outlineNumber}>XV</span><Icon name="tv" /><h2>{copy.local}</h2><p>{copy.localDescription}</p><button onClick={() => { setRegion("argentina"); setKind("match"); setDate(""); setOnlySaved(false); }}>{copy.match}<Icon name="arrow" /></button></div>
          <div className={s.bookmarkCard}><Icon name="star" /><h2>{copy.bookmarkTitle}</h2><p>{copy.bookmarkDescription}</p><div><strong>{EDITORIAL_AGENDA.filter((event) => event.kind === "match").length}</strong><span>{copy.matches}</span><strong>{EDITORIAL_AGENDA.filter((event) => event.kind === "show").length}</strong><span>{copy.shows}</span></div></div>
          <div className={s.sourceCard}><span>{copy.source}</span><strong>Norte Rugby</strong><p>15–22 OCT 2026</p><span>{copy.edition}</span></div>
        </aside>
      </div>
      <footer className={s.footer}><Link href="/">RUGBY NOW</Link><span>{copy.agenda} / 2026</span><Link href="/privacy">{copy.privacy}</Link></footer>
      {message && <div className={s.toast} role="status"><span>{message}</span><button onClick={() => setMessage("")} aria-label={copy.close}>×</button></div>}
    </main>
  </div>;
}

