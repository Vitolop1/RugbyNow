"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
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
  pf: number;
  pa: number;
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
  standings: StandingRow[];
  standingsSource?: "cache" | "computed";
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
}: {
  label: string;
  standing: StandingRow | null;
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
            <div className="text-right text-xs text-white/70">
              <div>PJ {standing.pj}</div>
              <div>W {standing.w} / D {standing.d} / L {standing.l}</div>
            </div>
          </div>
          {standing.form?.length ? (
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
  const [data, setData] = useState<MatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/matches/${matchId}?competition=${encodeURIComponent(competitionSlug)}`,
        { cache: "no-store" }
      );
      const payload = await response.json();

      if (cancelled) return;

      if (!response.ok) {
        setData(null);
        setError(payload.error ?? tr("unknownMatchError"));
      } else {
        setData(payload as MatchPayload);
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [competitionSlug, matchId, tr]);

  const kickoffLabel = useMemo(() => {
    if (!data) return null;
    return formatKickoffTZ(data.match.match_date, data.match.kickoff_time, timeZone, lang, data.competition.slug) ?? tr("tbd");
  }, [data, lang, timeZone, tr]);

  const clockLabel = useMemo(() => {
    if (!data) return "";
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

  return (
    <div className="rn-app-bg min-h-screen">
      <AppHeader subtitle={data ? `${data.competition.name}  |  ${data.season.name}` : tr("matchDetails")} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-white/80">{tr("loading")}</div>
        ) : error || !data ? (
          <div className="rounded-2xl border border-red-200/30 bg-black/20 p-6 text-white">
            <div className="font-bold">{tr("matchNotFound")}</div>
            <div className="mt-2 text-sm text-white/80">{error || tr("unknownMatchError")}</div>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur sm:p-8">
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

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <div className="flex items-center gap-4">
                  <TeamLogo slug={data.match.home_team?.slug} alt={data.match.home_team?.name || tr("teamHomeFallback")} size={56} />
                  <div className="min-w-0">
                    <Link href={data.match.home_team?.slug ? `/teams/${data.match.home_team.slug}` : "#"} className="text-2xl font-black text-white hover:text-emerald-200">
                      {data.match.home_team?.name || tr("teamHomeFallback")}
                    </Link>
                    <div className="mt-1 text-sm text-white/65">{data.homeStanding ? `#${data.homeStanding.position}  |  PTS ${data.homeStanding.pts}` : data.competition.region || "RugbyNow"}</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-5 text-center">
                  <div className="text-3xl font-black tracking-tight text-white">
                    {isScheduledMatchStatus(data.match.status) ? "-" : (data.match.home_score ?? "-")}{" "}
                    <span className="text-white/50">-</span>{" "}
                    {isScheduledMatchStatus(data.match.status) ? "-" : (data.match.away_score ?? "-")}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white/80">{clockLabel}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">{contextLabel}</div>
                </div>

                <div className="flex items-center justify-start gap-4 lg:justify-end">
                  <div className="min-w-0 text-right">
                    <Link href={data.match.away_team?.slug ? `/teams/${data.match.away_team.slug}` : "#"} className="text-2xl font-black text-white hover:text-emerald-200">
                      {data.match.away_team?.name || tr("teamAwayFallback")}
                    </Link>
                    <div className="mt-1 text-sm text-white/65">{data.awayStanding ? `#${data.awayStanding.position}  |  PTS ${data.awayStanding.pts}` : data.competition.region || "RugbyNow"}</div>
                  </div>
                  <TeamLogo slug={data.match.away_team?.slug} alt={data.match.away_team?.name || tr("teamAwayFallback")} size={56} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label={tr("date")} value={data.match.match_date} />
              <StatCard label={tr("kickoffLocal")} value={kickoffLabel} />
              <StatCard label={tr("venue")} value={data.match.venue || tr("tbd")} />
              <StatCard label={tr("source")} value={data.source || "supabase"} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                  <h2 className="text-xl font-black text-white">{tr("matchContext")}</h2>
                  <p className="mt-2 text-sm leading-7 text-white/75">
                    {data.homeStanding && data.awayStanding
                      ? `${data.match.home_team?.name} arrives ${data.homeStanding.position}. ${data.match.away_team?.name} arrives ${data.awayStanding.position}.`
                      : `${data.competition.name} ${data.match.round != null ? `${tr("round")} ${data.match.round}` : ""}`}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <TeamContextCard label={data.match.home_team?.name || tr("teamHomeFallback")} standing={data.homeStanding} />
                    <TeamContextCard label={data.match.away_team?.name || tr("teamAwayFallback")} standing={data.awayStanding} />
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
                  <div>
                    <div className="text-xl font-bold text-white">{tr("standings")}</div>
                    <div className="mt-1 text-sm text-white/70">
                      {data.standingsSource === "cache" ? tr("scrapedStandings") : tr("computedFromFT")}
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
                        <th className="px-3 py-3 text-right">PJ</th>
                        <th className="px-4 py-3 text-right">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.standings.map((row) => {
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
                            <td className="px-3 py-3 text-right">{row.pj}</td>
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
      </main>
    </div>
  );
}
