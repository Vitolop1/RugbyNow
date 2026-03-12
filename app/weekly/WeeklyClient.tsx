"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import { t } from "@/lib/i18n";
import type { WeeklyDigestPayload } from "@/lib/weeklyDigest";
import { usePrefs } from "@/lib/usePrefs";

type Props = {
  digest: WeeklyDigestPayload | null;
};

export default function WeeklyClient({ digest }: Props) {
  const { lang } = usePrefs();
  const tr = (key: string) => t(lang, key);
  const [selectedLeague, setSelectedLeague] = useState<string>("all");
  const leagues = useMemo(() => digest?.leagues || [], [digest]);
  const filtered = useMemo(
    () => (selectedLeague === "all" ? leagues : leagues.filter((league) => league.slug === selectedLeague)),
    [leagues, selectedLeague]
  );

  return (
    <div className="rn-app-bg min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-extrabold">{tr("weeklyHubTitle")}</h1>
          <p className="mt-3 text-white/80">{tr("weeklyHubBody")}</p>
          {digest ? (
            <p className="mt-3 text-xs text-white/60">
              {tr("weeklyUpdated")}: {new Date(digest.generatedAt).toLocaleString()} | {digest.windowStart} {"->"} {digest.windowEnd}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedLeague("all")}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              selectedLeague === "all" ? "border-emerald-300/40 bg-emerald-300/20" : "border-white/15 bg-black/20"
            }`}
          >
            {tr("all")}
          </button>
          {leagues.map((league) => (
            <button
              key={league.slug}
              onClick={() => setSelectedLeague(league.slug)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                selectedLeague === league.slug ? "border-emerald-300/40 bg-emerald-300/20" : "border-white/15 bg-black/20"
              }`}
            >
              {league.name}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-6">
          {filtered.map((league) => (
            <section key={league.slug} className="overflow-hidden rounded-3xl border border-white/15 bg-black/20 backdrop-blur">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold">{league.name}</h2>
                    <p className="text-sm text-white/70">
                      {league.group} | {league.region || tr("groupsOther")} | {league.articleCount} {tr("weeklyStories")}
                    </p>
                  </div>
                  <Link
                    href={`/leagues/${league.slug}`}
                    className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                  >
                    {tr("openLeague")}
                  </Link>
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">{tr("weeklyDigestLabel")}</div>
                    <p className="mt-3 text-base leading-7 text-white/90">{lang === "es" ? league.summaryEs || league.summary : league.summary}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("weeklyRecentMatches")}</div>
                      <div className="mt-3 space-y-3">
                        {league.recentMatches.length ? (
                          league.recentMatches.map((match) => (
                            <div key={`recent-${match.id}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                              <div className="text-xs text-white/60">{match.matchDate}</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {match.home} {match.homeScore ?? "-"} - {match.awayScore ?? "-"} {match.away}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-white/60">{tr("noMatchesSeason")}</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{tr("weeklyUpcomingMatches")}</div>
                      <div className="mt-3 space-y-3">
                        {league.upcomingMatches.length ? (
                          league.upcomingMatches.map((match) => (
                            <div key={`upcoming-${match.id}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                              <div className="text-xs text-white/60">{match.matchDate}</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {match.home} vs {match.away}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-white/60">{tr("noMatchesSeason")}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-white/60">{tr("weeklySourceLinks")}</div>
                  {league.articles.length ? (
                    league.articles.map((article) => (
                      <a
                        key={article.id}
                        href={article.link}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-bold text-white/70">
                            {article.source}
                          </span>
                          <span className="text-xs text-white/50">
                            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-extrabold text-white">
                          {lang === "es" ? article.titleEs || article.title : article.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-white/75">
                          {lang === "es" ? article.teaserEs || article.teaser : article.teaser}
                        </p>
                      </a>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">{tr("weeklyNoArticles")}</div>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
