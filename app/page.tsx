"use client";

import { useEffect, useMemo, useState } from "react";

type MatchStatus = "NS" | "LIVE" | "FT";

type Match = {
  timeLabel: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  status: MatchStatus;
};

type LeagueBlock = {
  league: string;
  region: string;
  matches: Match[];
};

const DATA: LeagueBlock[] = [
  {
    league: "France (Top 14)",
    region: "France",
    matches: [
      { timeLabel: "16:00", home: "Toulouse", away: "La Rochelle", hs: 0, as: 0, status: "NS" },
      { timeLabel: "LIVE 62'", home: "Bordeaux", away: "Racing 92", hs: 24, as: 19, status: "LIVE" },
      { timeLabel: "FT", home: "Toulon", away: "Clermont", hs: 30, as: 20, status: "FT" },
    ],
  },
  {
    league: "Italy (Serie A Elite)",
    region: "Italy",
    matches: [
      { timeLabel: "15:30", home: "Petrarca", away: "Calvisano", hs: 0, as: 0, status: "NS" },
      { timeLabel: "FT", home: "Rovigo", away: "Valorugby", hs: 22, as: 18, status: "FT" },
    ],
  },
  {
    league: "Super Rugby Americas",
    region: "Americas",
    matches: [
      { timeLabel: "LIVE 38'", home: "Pampas", away: "Peñarol", hs: 14, as: 10, status: "LIVE" },
      { timeLabel: "19:10", home: "Dogos XV", away: "Selknam", hs: 0, as: 0, status: "NS" },
    ],
  },
  {
    league: "Six Nations",
    region: "Europe",
    matches: [
      { timeLabel: "FT", home: "Ireland", away: "France", hs: 28, as: 24, status: "FT" },
      { timeLabel: "17:45", home: "England", away: "Scotland", hs: 0, as: 0, status: "NS" },
    ],
  },
];

function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-full bg-red-600 text-white">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "FT") {
    return (
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-200 text-neutral-800 dark:bg-white/10 dark:text-white">
        FT
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-white/5 dark:text-white/80 dark:border-white/10">
      PRE
    </span>
  );
}

export default function Home() {
  // null = todavía no cargamos theme (evita parpadeo y confusión)
  const [dark, setDark] = useState<boolean | null>(null);

  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");
  const [selectedLeague, setSelectedLeague] = useState<string>("All");

  // 1) Load theme once (DEFAULT = LIGHT if no saved theme)
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDark(true);
    else setDark(false);
  }, []);

  // 2) Apply theme to <html> so Tailwind dark: works
  useEffect(() => {
    if (dark === null) return;

    const html = document.documentElement;
    html.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const leagues = useMemo(() => ["All", ...DATA.map((x) => x.league)], []);

  const filteredBlocks = useMemo(() => {
    let blocks = DATA;

    if (selectedLeague !== "All") {
      blocks = blocks.filter((b) => b.league === selectedLeague);
    }

    if (tab === "LIVE") {
      blocks = blocks
        .map((b) => ({ ...b, matches: b.matches.filter((m) => m.status === "LIVE") }))
        .filter((b) => b.matches.length > 0);
    }

    return blocks;
  }, [selectedLeague, tab]);

  // While theme loads, render nothing (fast, avoids flash)
  if (dark === null) return null;

  return (
    <div
      className="
        min-h-screen transition-colors duration-300
        bg-gradient-to-br from-emerald-100 via-emerald-200 to-green-300
        dark:from-neutral-950 dark:via-neutral-950 dark:to-black
        text-neutral-900 dark:text-white
      "
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-neutral-950/80">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow" />
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-white/60">
                Live scores • Fixtures • Tables
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("ALL")}
              className={`px-3 py-2 rounded-full text-sm border transition ${
                tab === "ALL"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTab("LIVE")}
              className={`px-3 py-2 rounded-full text-sm border transition ${
                tab === "LIVE"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
              }`}
            >
              Live
            </button>

            <button
              onClick={() => setDark((v) => !v)}
              className="ml-2 px-3 py-2 rounded-full text-sm border transition
              bg-white/80 border-neutral-200 hover:bg-white
              dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
              title="Toggle theme"
            >
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>
      </header>

      {/* Layout */}
      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-black/50">
          <div className="text-sm font-semibold mb-3 text-neutral-700 dark:text-white/80">
            Leagues
          </div>

          <div className="space-y-2">
            {leagues.map((x) => {
              const active = selectedLeague === x;
              return (
                <button
                  key={x}
                  onClick={() => setSelectedLeague(x)}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10"
                  }`}
                >
                  {x}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              Rugby vibe
            </div>
            <div className="text-xs text-neutral-700 dark:text-white/70 mt-1">
              Clean UI, fast live updates, leagues you care about.
            </div>
          </div>
        </aside>

        {/* Boards */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Matches Today</h2>
            <p className="text-sm text-neutral-700 dark:text-white/60">
              Showing: {selectedLeague} • {tab === "LIVE" ? "Live only" : "All matches"}
            </p>
          </div>

          {filteredBlocks.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-black/45 dark:text-white/70">
              No matches found for this filter.
            </div>
          ) : (
            filteredBlocks.map((block) => (
              <div
                key={block.league}
                className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur overflow-hidden dark:border-white/10 dark:bg-black/45"
              >
                <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <div className="font-semibold">{block.league}</div>
                  </div>
                  <div className="text-sm text-neutral-700 dark:text-white/60">{block.region}</div>
                </div>

                <div className="divide-y divide-neutral-200 dark:divide-white/10">
                  {block.matches.map((m, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-3 flex items-center gap-4 transition ${
                        m.status === "LIVE"
                          ? "ring-1 ring-red-500/40 bg-red-50/60 dark:bg-red-500/10"
                          : "hover:bg-white/60 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="w-28">
                        <div className="text-sm text-neutral-700 dark:text-white/70">{m.timeLabel}</div>
                        <div className="mt-1">
                          <StatusBadge status={m.status} />
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-white/5 dark:border-white/10">
                          <span className="font-medium">{m.home}</span>
                          <span className="font-extrabold tabular-nums">{m.hs}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-white/5 dark:border-white/10">
                          <span className="font-medium">{m.away}</span>
                          <span className="font-extrabold tabular-nums">{m.as}</span>
                        </div>
                      </div>

                      <div className="hidden md:block w-36 text-right text-xs text-neutral-700 dark:text-white/50">
                        {m.status === "LIVE" ? "Live action" : m.status === "FT" ? "Final" : "Upcoming"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-800 dark:text-white/40">
        RugbyNow • Built for live rugby.
      </footer>
    </div>
  );
}
