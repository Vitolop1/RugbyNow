"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

type MatchStatus = "NS" | "LIVE" | "FT";

type TeamPayload = {
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

function TeamLogo({ slug, alt, size = 96 }: { slug?: string | null; alt: string; size?: number }) {
  return (
    <img
      src={getTeamLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="rounded-2xl bg-white/5 object-contain"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/team-logos/_placeholder.png";
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
  return <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${cls}`}>{value}</span>;
}

function niceDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatKickoffTZ(matchDate: string, kickoffTime: string | null, timeZone: string) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(`${matchDate}T${normalized}`)
  );
}

export default function TeamClient({ slug }: { slug: string }) {
  const { lang, timeZone } = usePrefs();
  const tr = (key: string) => t(lang, key);
  const [data, setData] = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/teams/${slug}`, { cache: "no-store" });
      const payload = await response.json();
      if (cancelled) return;

      if (!response.ok) {
        setData(null);
        setError(payload.error ?? "Unknown team error");
      } else {
        setData(payload as TeamPayload);
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const title = data?.profile.displayName || data?.team.name || "Club";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E4F33] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-lime-200/10 blur-3xl" />
      </div>

      <div className="relative">
        <AppHeader title={title} subtitle={data?.profile.country || data?.profile.city || undefined} />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {loading ? (
            <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-white/80">{tr("loadingMatches")}</div>
          ) : error || !data ? (
            <div className="rounded-2xl border border-red-200/20 bg-red-400/10 p-8 text-red-100">{error || "Team not found"}</div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <TeamLogo slug={data.team.slug} alt={data.team.name} size={112} />
                    <div>
                      <h1 className="text-3xl font-black tracking-tight text-white">{data.profile.displayName || data.team.name}</h1>
                      <p className="mt-2 max-w-2xl text-sm text-white/80">{data.profile.summary}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {data.profile.country ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{data.profile.country}</span> : null}
                        {data.profile.city ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{data.profile.city}</span> : null}
                        {data.profile.founded ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{tr("founded")}: {data.profile.founded}</span> : null}
                        {data.profile.venue ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{tr("venue")}: {data.profile.venue}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-[260px] grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/60">{tr("played")}</div>
                      <div className="mt-2 text-3xl font-black text-white">{data.stats.played}</div>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/60">{tr("winRate")}</div>
                      <div className="mt-2 text-3xl font-black text-white">{data.stats.winRate}%</div>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/60">PF / PA</div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {data.stats.pointsFor} / {data.stats.pointsAgainst}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/60">{tr("recentForm")}</div>
                      <div className="mt-2 flex gap-1">
                        {data.stats.form.map((value, index) => (
                          <FormPill key={`${value}-${index}`} value={value} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                    <h2 className="text-xl font-bold text-white">{tr("about")}</h2>
                    <p className="mt-3 text-sm leading-7 text-white/80">{data.profile.history}</p>
                    {data.profile.colors?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {data.profile.colors.map((color) => (
                          <span key={color} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
                            {color}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                    <h2 className="text-xl font-bold text-white">{tr("recentMatches")}</h2>
                    <div className="mt-4 space-y-3">
                      {data.recentMatches.map((match) => (
                        <div key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <Link href={`/leagues/${match.competition?.slug || ""}`} className="flex items-center gap-2 text-sm font-semibold text-white/85 hover:text-white">
                              <img
                                src={getLeagueLogo(match.competition?.slug)}
                                alt={match.competition?.name || "League"}
                                width={18}
                                height={18}
                                className="rounded-sm bg-white/5 object-contain"
                              />
                              <span>{match.competition?.name || "League"}</span>
                            </Link>
                            <span className="text-xs text-white/60">{niceDate(match.match_date)}</span>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <Link href={`/teams/${match.home_team?.slug || ""}`} className="truncate text-sm font-semibold text-white hover:text-emerald-200">
                              {match.home_team?.name || tr("teamHomeFallback")}
                            </Link>
                            <div className="text-center text-lg font-black tabular-nums text-white">
                              {match.status === "NS" ? "—" : `${match.home_score ?? "-"} - ${match.away_score ?? "-"}`}
                            </div>
                            <Link href={`/teams/${match.away_team?.slug || ""}`} className="truncate text-right text-sm font-semibold text-white hover:text-emerald-200">
                              {match.away_team?.name || tr("teamAwayFallback")}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                    <h2 className="text-xl font-bold text-white">{tr("upcomingMatches")}</h2>
                    <div className="mt-4 space-y-3">
                      {data.upcomingMatches.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">{tr("noMatchesRound")}</div>
                      ) : (
                        data.upcomingMatches.map((match) => (
                          <div key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs text-white/60">
                              {niceDate(match.match_date)} • {formatKickoffTZ(match.match_date, match.kickoff_time, timeZone) || tr("tbd")}
                            </div>
                            <div className="mt-2 text-sm text-white">
                              {match.home_team?.name || tr("teamHomeFallback")} vs {match.away_team?.name || tr("teamAwayFallback")}
                            </div>
                            {match.competition ? (
                              <Link href={`/leagues/${match.competition.slug}`} className="mt-2 inline-flex text-xs text-emerald-200 hover:text-emerald-100">
                                {match.competition.name}
                              </Link>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                    <h2 className="text-xl font-bold text-white">{tr("competitions")}</h2>
                    <div className="mt-4 space-y-3">
                      {data.competitions.map((competition) => (
                        <Link
                          key={competition.slug}
                          href={`/leagues/${competition.slug}`}
                          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"
                        >
                          <img
                            src={getLeagueLogo(competition.slug)}
                            alt={competition.name}
                            width={22}
                            height={22}
                            className="rounded-sm bg-white/5 object-contain"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{competition.name}</div>
                            <div className="text-xs text-white/60">
                              {competition.region || "Region"} • {competition.seasons.join(", ")}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
