"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import SuggestedWatchButton from "@/app/components/SuggestedWatchButton";
import { getDateLocale } from "@/lib/dateLocale";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

type MatchStatus = "NS" | "LIVE" | "HT" | "FT" | "CANC";

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

function TeamLogo({ slug, alt, size = 104 }: { slug?: string | null; alt: string; size?: number }) {
  return (
    <img
      src={getTeamLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="rounded-3xl bg-white/5 object-contain"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/team-logos/_placeholder.png";
      }}
    />
  );
}

function FormPill({ value, lang }: { value: "W" | "D" | "L"; lang: "en" | "es" | "fr" | "it" }) {
  const tr = (key: string) => t(lang, key);
  const cls =
    value === "W"
      ? "bg-green-500/90 text-white"
      : value === "D"
        ? "bg-amber-400/90 text-black"
        : "bg-red-500/90 text-white";
  const label = value === "W" ? tr("formWin") : value === "D" ? tr("formDraw") : tr("formLoss");

  return <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-black ${cls}`}>{label}</span>;
}

function niceDate(iso: string, lang: "en" | "es" | "fr" | "it") {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(getDateLocale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatKickoffTZ(
  matchDate: string,
  kickoffTime: string | null,
  timeZone: string,
  lang: "en" | "es" | "fr" | "it"
) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  const [hourRaw = "00", minuteRaw = "00"] = normalized.split(":");
  const hour24 = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour24) || Number.isNaN(minute)) return null;

  return new Intl.DateTimeFormat(getDateLocale(lang), { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, 0, 1, hour24, minute))
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className={`mt-2 text-3xl font-black ${accent ?? "text-white"}`}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{label}</div>
      <div className="text-right text-sm font-semibold text-white/90">{value}</div>
    </div>
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
        setError(payload.error ?? tr("unknownTeamError"));
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

  const title = data?.profile.displayName || data?.team.name || tr("teamLabel");
  const profileSummary = data?.profile.summary || `${title} en RugbyNow.`;
  const profileHistory =
    data?.profile.history ||
    "Ficha institucional en construccion. Esta pagina va a sumar historia, estadio, ciudad, fundacion y mas metadata a medida que carguemos informacion curada.";
  const countrySummary = data?.countryProfile?.summary ?? null;
  const countryHistory = data?.countryProfile?.rugbyContext ?? null;
  const recordLine = useMemo(
    () => `${data?.stats.won ?? 0}-${data?.stats.drawn ?? 0}-${data?.stats.lost ?? 0}`,
    [data?.stats.won, data?.stats.drawn, data?.stats.lost]
  );

  return (
    <div className="rn-app-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-lime-200/10 blur-3xl" />
      </div>

      <div className="relative">
        <AppHeader />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {loading ? (
            <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-white/80">{tr("loadingMatches")}</div>
          ) : error || !data ? (
            <div className="rounded-2xl border border-red-200/20 bg-red-400/10 p-8 text-red-100">{error || tr("teamNotFound")}</div>
          ) : (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[28px] border border-white/15 bg-black/20 backdrop-blur">
                <div className="border-b border-white/10 px-6 py-5">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/70">{tr("teamLabel")}</div>
                </div>

                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.9fr]">
                  <div className="space-y-5">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <TeamLogo slug={data.team.slug} alt={data.team.name} size={120} />
                      <div className="min-w-0">
                        <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">{profileSummary}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {data.profile.country ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{data.profile.country}</span> : null}
                          {data.profile.city ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{data.profile.city}</span> : null}
                          {data.profile.venue ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs">{data.profile.venue}</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard label={tr("played")} value={data.stats.played} />
                      <StatCard label={tr("recordLabel")} value={recordLine} />
                      <StatCard label={tr("winRate")} value={`${data.stats.winRate}%`} accent="text-emerald-200" />
                      <StatCard label={tr("pointsBalance")} value={`${data.stats.pointsFor} / ${data.stats.pointsAgainst}`} />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("clubInfo")}</div>
                    <div className="mt-3">
                      <InfoRow label={tr("teamLabel")} value={title} />
                      <InfoRow label={tr("founded")} value={data.profile.founded} />
                      <InfoRow label={tr("venue")} value={data.profile.venue} />
                      <InfoRow label={tr("city")} value={data.profile.city} />
                      <InfoRow label={tr("country")} value={data.profile.country} />
                    </div>

                    {data.profile.colors?.length ? (
                      <div className="mt-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{tr("colors")}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {data.profile.colors.map((color) => (
                            <span key={color} className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs font-semibold text-white/85">
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{tr("recentForm")}</div>
                      <div className="mt-3 flex gap-1.5">
                        {data.stats.form.length ? data.stats.form.map((value, index) => <FormPill key={`${value}-${index}`} value={value} lang={lang} />) : <span className="text-sm text-white/60">{tr("noFormYet")}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="space-y-6">
                  <div className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("about")}</div>
                    <h2 className="mt-2 text-2xl font-black text-white">{tr("institutionalSnapshot")}</h2>
                    <p className="mt-4 text-sm leading-7 text-white/80">{profileHistory}</p>
                  </div>

                  {countrySummary ? (
                    <div className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("countrySection")}</div>
                      <h2 className="mt-2 text-2xl font-black text-white">{data?.countryProfile?.name}</h2>
                      <p className="mt-4 text-sm leading-7 text-white/80">{countrySummary}</p>
                      {countryHistory ? <p className="mt-3 text-sm leading-7 text-white/70">{countryHistory}</p> : null}
                    </div>
                  ) : null}

                  <div className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("recentMatches")}</div>
                        <h2 className="mt-2 text-2xl font-black text-white">{tr("lastResults")}</h2>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {data.recentMatches.map((match) => (
                        <div key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <Link href={`/leagues/${match.competition?.slug || ""}`} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white/85 hover:text-white">
                              <img
                                src={getLeagueLogo(match.competition?.slug)}
                                alt={match.competition?.name || tr("league")}
                                width={18}
                                height={18}
                                className="rounded-sm bg-white/5 object-contain"
                              />
                              <span className="truncate">{match.competition?.name || tr("league")}</span>
                            </Link>
                            <span className="shrink-0 text-xs text-white/60">{niceDate(match.match_date, lang)}</span>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <Link href={match.home_team?.slug ? `/teams/${match.home_team.slug}` : "#"} className="truncate text-sm font-semibold text-white hover:text-emerald-200">
                              {match.home_team?.name || tr("teamHomeFallback")}
                            </Link>
                            <div className="text-center text-lg font-black tabular-nums text-white">
                              {match.status === "NS" || match.status === "CANC" ? "—" : `${match.home_score ?? "-"} - ${match.away_score ?? "-"}`}
                            </div>
                            <Link href={match.away_team?.slug ? `/teams/${match.away_team.slug}` : "#"} className="truncate text-right text-sm font-semibold text-white hover:text-emerald-200">
                              {match.away_team?.name || tr("teamAwayFallback")}
                            </Link>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <SuggestedWatchButton
                              competitionSlug={match.competition?.slug}
                              competitionName={match.competition?.name}
                              home={match.home_team?.name}
                              away={match.away_team?.name}
                              lang={lang}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("upcomingMatches")}</div>
                    <h2 className="mt-2 text-2xl font-black text-white">{tr("nextFixtures")}</h2>

                    <div className="mt-5 space-y-3">
                      {data.upcomingMatches.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">{tr("noMatchesRound")}</div>
                      ) : (
                        data.upcomingMatches.map((match) => (
                          <div key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs text-white/60">
                              {niceDate(match.match_date, lang)} | {formatKickoffTZ(match.match_date, match.kickoff_time, timeZone, lang) || tr("tbd")}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white">
                              {match.home_team?.name || tr("teamHomeFallback")} {tr("versus")} {match.away_team?.name || tr("teamAwayFallback")}
                            </div>
                            {match.competition ? (
                              <Link href={`/leagues/${match.competition.slug}`} className="mt-2 inline-flex text-xs text-emerald-200 hover:text-emerald-100">
                                {match.competition.name}
                              </Link>
                            ) : null}
                            <div className="mt-3 flex justify-end">
                              <SuggestedWatchButton
                                competitionSlug={match.competition?.slug}
                                competitionName={match.competition?.name}
                                home={match.home_team?.name}
                                away={match.away_team?.name}
                                lang={lang}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("competitions")}</div>
                    <h2 className="mt-2 text-2xl font-black text-white">{tr("competitions")}</h2>

                    <div className="mt-5 space-y-3">
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
                              {competition.region || tr("region")} | {competition.seasons.join(", ")}
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
