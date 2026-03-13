"use client";

import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

type Props = {
  competitionSlug?: string;
  competitionName?: string;
  home?: string;
  away?: string;
};

type SourceCard = {
  id: string;
  name: string;
  label: string;
  placeholderHref: string;
};

const PLACEHOLDER_SOURCES: SourceCard[] = [
  {
    id: "tvlibr3",
    name: "TVLibr3",
    label: "tvlibr3.com",
    placeholderHref: "https://placeholder.invalid/tvlibr3",
  },
  {
    id: "vipleague",
    name: "VIPLeague Rugby",
    label: "vipleague.ws/rugby-sports-stream",
    placeholderHref: "https://placeholder.invalid/vipleague-rugby",
  },
  {
    id: "viprow",
    name: "VIPRow Rugby",
    label: "viprow.co/sports-rugby-online",
    placeholderHref: "https://placeholder.invalid/viprow-rugby",
  },
  {
    id: "rugbybox",
    name: "RugbyBox",
    label: "rugbybox.me",
    placeholderHref: "https://placeholder.invalid/rugbybox",
  },
];

function prettifyCompetition(competitionName?: string, competitionSlug?: string) {
  if (competitionName?.trim()) return competitionName.trim();
  if (!competitionSlug?.trim()) return "Rugby";

  return competitionSlug
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export default function WatchClient({ competitionSlug, competitionName, home, away }: Props) {
  const { lang } = usePrefs();
  const tr = (key: string) => t(lang, key);

  const fixture =
    home?.trim() && away?.trim()
      ? `${home.trim()} vs ${away.trim()}`
      : home?.trim() || away?.trim() || "Team A vs Team B";
  const competition = prettifyCompetition(competitionName, competitionSlug);

  return (
    <div className="rn-app-bg min-h-screen overflow-hidden">
      <AppHeader title={fixture} subtitle={competition} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-[32px] border border-white/15 bg-black/20 p-6 backdrop-blur sm:p-8">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-white/55">{tr("watchHubTitle")}</div>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">{fixture}</h1>
            <p className="mt-3 text-sm leading-7 text-white/80 sm:text-base">{tr("watchHubBody")}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                {tr("watchFixtureLabel")}
              </div>
              <div className="mt-2 text-lg font-extrabold text-white">{fixture}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                {tr("watchCompetitionLabel")}
              </div>
              <div className="mt-2 text-lg font-extrabold text-white">{competition}</div>
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-[32px] border border-white/15 bg-black/20 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/55">{tr("watchListTitle")}</div>
              <h2 className="mt-2 text-2xl font-black text-white">Streaming preview</h2>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
            >
              {tr("watchBackHome")}
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {PLACEHOLDER_SOURCES.map((source, index) => (
              <article
                key={source.id}
                className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                      {tr("watchSourceLabel")} {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="mt-2 text-xl font-black text-white">{source.name}</h3>
                    <div className="mt-1 text-sm text-emerald-100/80">{source.label}</div>
                  </div>
                  <div className="rounded-full border border-sky-200/30 bg-sky-300/20 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                    TV
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">
                    {tr("watchDestinationLabel")}
                  </div>
                  <div className="mt-2 break-all rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-3 font-mono text-xs text-white/85">
                    {source.placeholderHref}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/70">{tr("watchPlaceholderNote")}</p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-white/50">{tr("watchPlaceholderLink")}</div>
                  <a
                    href={source.placeholderHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-sky-200/30 bg-sky-300/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-300/30"
                  >
                    {tr("watchOpenPlaceholder")}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
