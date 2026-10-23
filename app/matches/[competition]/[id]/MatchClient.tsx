"use client";

import PendingCalendar from "@/app/components/PendingCalendar";
import type {PendingProD2Fixture} from "@/lib/proD2CalendarData";
import LiveStatusBadge from "@/app/components/LiveStatusBadge";
import {sourceStatusLabel,readSourceStatusDetail} from "@/lib/sourceStatusDetail";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import PortalShell from "@/app/components/PortalShell";
import RugbyBall from "@/app/components/RugbyBall";
import LiveFreshness from "@/app/components/LiveFreshness";
import {preferNewerReading} from "@/lib/liveRefresh";
import HeadToHead from "@/app/components/HeadToHead";
import type { HeadToHeadData } from "@/lib/headToHead";
import BroadcastCountrySelect from "@/app/components/BroadcastCountrySelect";
import BroadcasterLogo from "@/app/components/BroadcasterLogo";
import { useBroadcastCountry, broadcastCountryLabel } from "@/lib/useBroadcastCountry";
import { getMatchTelevision } from "@/lib/matchBroadcasts";
import { trackProductEvent } from "@/lib/analytics";
import SuggestedWatchButton from "@/app/components/SuggestedWatchButton";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
import { t } from "@/lib/i18n";
import { formatKickoffTZ, getMatchClockLabel, getMatchContextLabel } from "@/lib/matchPresentation";
import { isScheduledMatchStatus, type MatchStatus } from "@/lib/matchStatus";
import { usePrefs } from "@/lib/usePrefs";

type TeamRef = {
  id: number;
  name: string;
  slug: string | null;
};

type StandingRow = {
  position: number;
  teamId: number;
  team: string;
  teamSlug: string | null;
  pj: number;
  w: number;
  d: number;
  l: number;
  pf: number|null;
  pa: number|null;
  difference?:number;
  group?:string;
  pts: number;
  form?: Array<"W" | "D" | "L">;
};

type MatchPayload = {
  competition: {
    id: number;
    name: string;
    slug: string;
    region: string | null;
  };
  season: {
    id: number;
    name: string;
  };
  match: {
    id: number;
    match_date: string;
    kickoff_time: string | null;
    status: MatchStatus;
    minute: number | null;
    updated_at?: string | null;
    source_url?: string | null;
    home_score: number | null;
    away_score: number | null;
    round: number | null;
    venue?: string | null;
    home_team: TeamRef | null;
    away_team: TeamRef | null;
  };
  headToHead?: HeadToHeadData | null;
  standings: StandingRow[];
  standingsSource?: "cache" | "computed" | "curated" | "official" | "unavailable";
  homeStanding: StandingRow | null;
  awayStanding: StandingRow | null;
  source?: string;
};

function TeamLogo({ slug, alt, size = 44 }: { slug?: string | null; alt: string; size?: number }) {
  return (
    <img
      src={getTeamLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="rounded-sm bg-white/5 object-contain"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/team-logos/_placeholder.png";
      }}
    />
  );
}

function LeagueLogo({ slug, alt, size = 24 }: { slug?: string | null; alt: string; size?: number }) {
  return (
    <img
      src={getLeagueLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="rounded-sm bg-white/5 object-contain"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/league-logos/_placeholder.png";
      }}
    />
  );
}

function FormPill({ value }: { value: "W" | "D" | "L" }) {
  const cls =
    value === "W"
      ? "bg-green-500/90 text-white"
      : value === "D"
        ? "bg-amber-400/90 text-black"
        : "bg-red-500/90 text-white";

  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black ${cls}`}>{value}</span>;
}

function StatCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="mt-2 text-lg font-extrabold text-white">{value ?? "-"}</div>
    </div>
  );
}

function TeamContextCard({
  label,
  standing,
  compact = false,
}: {
  label: string;
  standing: StandingRow | null;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">{label}</div>
      {!standing ? (
        <div className="mt-3 text-sm text-white/65">-</div>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-extrabold text-white">#{standing.position}</div>
              <div className="text-xs text-white/65">PTS {standing.pts}</div>
            </div>
            {!compact ? (
              <div className="text-right text-xs text-white/70">
                <div>PJ {standing.pj}</div>
                <div>W {standing.w} / D {standing.d} / L {standing.l}</div>
              </div>
            ) : null}
          </div>
          {!compact && standing.form?.length ? (
            <div className="mt-3 flex gap-1.5">
              {standing.form.map((value, index) => (
                <FormPill key={`${standing.teamId}-${index}-${value}`} value={value} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function MatchClient() {
  const params = useParams<{ competition: string; id: string }>();
  const competitionSlug = params?.competition ?? "";
  const matchId = params?.id ?? "";
  const { lang, timeZone } = usePrefs();
  const tr = (key: string) => t(lang, key);
  const {country:tvCountry,setCountry:setTvCountry}=useBroadcastCountry(competitionSlug==="fr-pro-d2"?"FR":"AR");
  const [pending,setPending]=useState<PendingProD2Fixture|null>(null);
  const [data, setData] = useState<MatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const load=async(initial=false)=>{
      if(initial){setPending(null);setData(null);setLoading(true);setError("");}
      let delay=60000;
      try{
        const response=await fetch(`/api/matches/${matchId}?competition=${encodeURIComponent(competitionSlug)}`,{cache:"no-store",signal:controller.signal});
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error || t(lang,"unknownMatchError"));
        if(controller.signal.aborted)return;
        if(payload.pendingFixture){setPending(payload.pendingFixture);setData(null);setError("");return;}
        if(!payload.match)throw new Error(t(lang,"unknownMatchError"));
        setData(previous=>({...payload,match:preferNewerReading(previous&&previous.match.id===payload.match.id?previous.match:undefined,payload.match as MatchPayload["match"],row=>row.updated_at)} as MatchPayload));setError("");
        if(payload.match?.status==="LIVE"||payload.match?.status==="HT")delay=15000;
      }catch(error){
        if(controller.signal.aborted)return;
        setError(error instanceof Error?error.message:t(lang,"unknownMatchError"));
      }finally{
        if(!controller.signal.aborted){setLoading(false);timer=setTimeout(()=>load(),delay);}
      }
    };
    load(true);
    return()=>{controller.abort();clearTimeout(timer);};
  },[competitionSlug,matchId,lang]);

  const kickoffLabel = useMemo(() => {
    if (!data) return null;
    return formatKickoffTZ(data.match.match_date, data.match.kickoff_time, timeZone, lang, data.competition.slug) ?? t(lang, "tbd");
  }, [data, lang, timeZone]);

  const clockLabel = useMemo(() => {
    if (!data) return "";
    const sourceLabel=sourceStatusLabel(data.match.source_url,lang);if(sourceLabel)return sourceLabel;
    return getMatchClockLabel({
      competitionSlug: data.competition.slug,
      status: data.match.status,
      minute: data.match.minute,
      updatedAt: data.match.updated_at,
      matchDate: data.match.match_date,
      kickoffTime: data.match.kickoff_time,
      homeScore: data.match.home_score,
      awayScore: data.match.away_score,
      timeZone,
      lang,
    });
  }, [data, lang, timeZone]);

  const contextLabel = useMemo(() => {
    if (!data) return "";
    return getMatchContextLabel({
      competitionSlug: data.competition.slug,
      status: data.match.status,
      minute: data.match.minute,
      updatedAt: data.match.updated_at,
      matchDate: data.match.match_date,
      kickoffTime: data.match.kickoff_time,
      homeScore: data.match.home_score,
      awayScore: data.match.away_score,
      timeZone,
      lang,
    });
  }, [data, lang, timeZone]);

  const startsAt=data?.match.kickoff_time?`${data.match.match_date}T${data.match.kickoff_time.length===5?`${data.match.kickoff_time}:00`:data.match.kickoff_time}Z`:null;
  const television=data?getMatchTelevision({competitionSlug:data.competition.slug,home:data.match.home_team?.name,away:data.match.away_team?.name,startsAt,country:tvCountry}):null;
  const tvCopy={es:{pending:"Transmisión por confirmar para este país.",source:"Fuente",note:"Acceso al canal o plataforma. Puede requerir suscripción."},en:{pending:"Broadcast unconfirmed for this country.",source:"Source",note:"Channel or platform link. A subscription may be required."},fr:{pending:"Diffusion à confirmer dans ce pays.",source:"Source",note:"Lien vers la chaîne ou plateforme. Abonnement possible."},it:{pending:"Trasmissione da confermare in questo paese.",source:"Fonte",note:"Link al canale o piattaforma. Potrebbe richiedere un abbonamento."}}[lang];
  const isCuratedStandings = data?.standingsSource === "curated";
  const hasListedStandings = data?.standingsSource === "cache" || data?.standingsSource === "official" || isCuratedStandings;

  if(pending)return <PortalShell title={`${pending.home} vs ${pending.away}`} subtitle={`${pending.competitionSlug==="fr-top14"?"Top 14":"Pro D2"} · ${pending.season}`}><PendingCalendar fixtures={[pending]} compact/><p className="rn-notice"><Link href={`/leagues/${pending.competitionSlug}`}>{pending.competitionSlug==="fr-top14"?"Top 14":"Pro D2"} →</Link></p></PortalShell>;
  return (
    <PortalShell title={tr("matchDetails")} subtitle={data?`${data.competition.name} · ${data.season.name}`:undefined}>
      <div className="rn-match-detail">
        {loading ? (
          <div className="rn-notice" role="status"><RugbyBall spinning/>{tr("loading")}</div>
        ) : !data ? (
          <div className="rounded-2xl border border-red-200/30 bg-black/20 p-6 text-white">
            <div className="font-bold">{tr("matchNotFound")}</div>
            <div className="mt-2 text-sm text-white/80">{error || tr("unknownMatchError")}</div>
          </div>
        ) : (
          <div className="space-y-4">
            {error&&<p className="rn-notice" role="status">{error}</p>}
            <LiveFreshness status={data.match.status} updatedAt={data.match.updated_at}/>
            <section className="rounded-md border border-white/15 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                <Link href={`/leagues/${data.competition.slug}`} className="flex items-center gap-2 hover:text-emerald-200">
                  <LeagueLogo slug={data.competition.slug} alt={data.competition.name} />
                  <span className="font-semibold text-white">{data.competition.name}</span>
                </Link>
                <span>•</span>
                <span>{tr("seasonLabel")}: {data.season.name}</span>
                {data.match.round != null ? (
                  <>
                    <span>•</span>
                    <span>{tr("round")} {data.match.round}</span>
                  </>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 grid-cols-[1fr_auto_1fr] items-center">
                <div className="flex items-center gap-2">
                  <TeamLogo slug={data.match.home_team?.slug} alt={data.match.home_team?.name || tr("teamHomeFallback")} size={32} />
                  <div className="min-w-0">
                    <Link href={data.match.home_team?.slug ? `/teams/${data.match.home_team.slug}` : "#"} className="text-sm font-bold text-white hover:text-emerald-200">
                      {data.match.home_team?.name || tr("teamHomeFallback")}
                    </Link>
                    <div className="mt-1 text-sm text-white/65">{hasListedStandings && data.homeStanding ? `#${data.homeStanding.position}  |  PTS ${data.homeStanding.pts}` : data.competition.region || "RugbyNow"}</div>
                  </div>
                </div>

                <div className="rounded-md border border-white/15 bg-white/5 px-3 py-3 text-center">
                  <div className="text-2xl font-black tracking-tight text-white">
                    {isScheduledMatchStatus(data.match.status) ? "-" : (data.match.home_score ?? "-")}{" "}
                    <span className="text-white/50">-</span>{" "}
                    {isScheduledMatchStatus(data.match.status) ? "-" : (data.match.away_score ?? "-")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white/80">{["LIVE","HT","extra-time","shootout"].includes(readSourceStatusDetail(data.match.source_url)||data.match.status)?<LiveStatusBadge state={readSourceStatusDetail(data.match.source_url)||data.match.status} label={clockLabel}/>:clockLabel}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">{contextLabel}</div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <div className="min-w-0 text-right">
                    <Link href={data.match.away_team?.slug ? `/teams/${data.match.away_team.slug}` : "#"} className="text-sm font-bold text-white hover:text-emerald-200">
                      {data.match.away_team?.name || tr("teamAwayFallback")}
                    </Link>
                    <div className="mt-1 text-sm text-white/65">{hasListedStandings && data.awayStanding ? `#${data.awayStanding.position}  |  PTS ${data.awayStanding.pts}` : data.competition.region || "RugbyNow"}</div>
                  </div>
                  <TeamLogo slug={data.match.away_team?.slug} alt={data.match.away_team?.name || tr("teamAwayFallback")} size={32} />
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard label={tr("date")} value={new Intl.DateTimeFormat(lang,{day:"numeric",month:"short",year:"numeric",timeZone:startsAt?timeZone:"UTC"}).format(new Date(startsAt || `${data.match.match_date}T12:00:00Z`))} />
              <StatCard label={tr("kickoffLocal")} value={kickoffLabel} />
              <StatCard label={tr("venue")} value={data.match.venue || tr("tbd")} />
              <StatCard label={tr("seasonLabel")} value={data.season.name} />
            </section>

            <section className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">{tr("watchOn")}</h2>
                  <p className="mt-2 text-sm text-white/75">
                    {data.match.home_team?.name || tr("teamHomeFallback")} vs {data.match.away_team?.name || tr("teamAwayFallback")}
                  </p>
                </div>
                <SuggestedWatchButton
                  match={{id:data.match.id,date:data.match.match_date}}
                  competitionSlug={data.competition.slug}
                  competitionName={data.competition.name}
                  home={data.match.home_team?.name}
                  away={data.match.away_team?.name}
                  lang={lang}
                />
              </div>

              <div className="rn-detail-tv">
                <BroadcastCountrySelect value={tvCountry} onChange={setTvCountry}/>
                <span>{broadcastCountryLabel(tvCountry,lang)}</span>
                {television?.pending&&<strong className="rn-tv-pending">{tvCopy.pending}</strong>}
                <div className="rn-detail-tv-providers">{television?television.providers.map(provider=>provider.href&&!television.pending?<a key={provider.id} href={provider.href} target="_blank" rel="noopener noreferrer" onClick={()=>trackProductEvent("watch_provider_click",{match_id:data.match.id,provider_id:provider.id,link_type:provider.linkType||"channel"})}><BroadcasterLogo id={provider.id} name={provider.name}/>{provider.name} ↗</a>:<span key={provider.id}><BroadcasterLogo id={provider.id} name={provider.name}/>{provider.name}</span>):<p>{tvCopy.pending}</p>}</div>
                {television&&<p>{tvCopy.source}: {television.sourceUrl?<a href={television.sourceUrl} target="_blank" rel="noopener noreferrer">{television.sourceName} ↗</a>:television.sourceName}. {tvCopy.note}</p>}
              </div>
            </section>

            <HeadToHead data={data.headToHead} lang={lang} timeZone={timeZone}/>
            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                  <h2 className="text-xl font-black text-white">{tr("matchContext")}</h2>
                  <p className="mt-2 text-sm leading-7 text-white/75">
                    {hasListedStandings && data.homeStanding && data.awayStanding
                      ? `${data.match.home_team?.name} · #${data.homeStanding.position} / ${data.match.away_team?.name} · #${data.awayStanding.position}`
                      : `${data.competition.name} ${data.match.round != null ? `${tr("round")} ${data.match.round}` : ""}`}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <TeamContextCard
                      label={data.match.home_team?.name || tr("teamHomeFallback")}
                      standing={hasListedStandings ? data.homeStanding : null}
                      compact={isCuratedStandings}
                    />
                    <TeamContextCard
                      label={data.match.away_team?.name || tr("teamAwayFallback")}
                      standing={hasListedStandings ? data.awayStanding : null}
                      compact={isCuratedStandings}
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
                  <div>
                    <div className="text-xl font-bold text-white">{tr("standings")} {data.homeStanding?.group&&<small>· {data.homeStanding.group}</small>}</div>
                    <div className="mt-1 text-sm text-white/70">
                      {data.standingsSource === "cache"
                        ? tr("scrapedStandings")
                        : data.standingsSource === "curated"
                          ? tr("curatedStandings")
                          : data.standingsSource === "official" ? ({es:"Tabla oficial",en:"Official table",fr:"Classement officiel",it:"Classifica ufficiale"})[lang] : ({es:"Tabla todavía sin verificar para esta edición y fase",en:"Standings not yet verified for this edition and phase",fr:"Classement non vérifié pour cette édition et phase",it:"Classifica non verificata per questa edizione e fase"})[lang]}
                    </div>
                  </div>
                  <Link href={`/leagues/${data.competition.slug}`} className="text-sm font-semibold text-emerald-200 hover:text-emerald-100">
                    {tr("openLeague")}
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5 text-white/70">
                      <tr>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">{tr("teamLabel")}</th>
                        {!isCuratedStandings ? <th className="px-3 py-3 text-right">PJ</th> : null}
                        <th className="px-4 py-3 text-right">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.standings.filter(row=>!row.group||!data.homeStanding?.group||row.group===data.homeStanding.group).map((row) => {
                        const isHighlighted =
                          row.teamId === data.match.home_team?.id || row.teamId === data.match.away_team?.id;
                        return (
                          <tr
                            key={row.teamId}
                            className={`border-t border-white/10 ${isHighlighted ? "bg-emerald-300/10" : ""}`}
                          >
                            <td className="px-4 py-3 text-white/80">{row.position}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={row.teamSlug ? `/teams/${row.teamSlug}` : "#"}
                                className="font-semibold text-white hover:text-emerald-200"
                              >
                                {row.team}
                              </Link>
                            </td>
                            {!isCuratedStandings ? <td className="px-3 py-3 text-right">{row.pj}</td> : null}
                            <td className="px-4 py-3 text-right font-extrabold text-white">{row.pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
