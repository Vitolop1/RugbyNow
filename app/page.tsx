"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

// Lo que viene de Supabase (con joins)
type DbMatchRow = {
  id: number;
  match_date: string; // "2026-02-05"
  kickoff_time: string | null; // "14:10:00" o null
  status: MatchStatus;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue: string | null;

  home_team: { id: number; name: string; slug: string } | null;
  away_team: { id: number; name: string; slug: string } | null;

  season:
    | {
        id: number;
        name: string;
        competition: { id: number; name: string; slug: string; region: string | null } | null;
      }
    | null;
};

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
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-white">
        FT
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-neutral-900 dark:text-white/80 dark:border-white/10">
      PRE
    </span>
  );
}

// Helpers de fecha
function toISODateLocal(d: Date) {
  // yyyy-mm-dd en timezone local (no UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, delta: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}
function niceDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default function Home() {
  // THEME
  const [dark, setDark] = useState<boolean>(false);

  // FILTERS
  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");
  const [selectedLeague, setSelectedLeague] = useState<string>("All");

  // DATE NAV
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // DATA
  const [blocks, setBlocks] = useState<LeagueBlock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  // 1) Load saved theme once
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);

  // 2) Apply theme to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // 3) Load matches for selected day (real)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError("");

      const dayISO = toISODateLocal(selectedDate);

      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          id,
          match_date,
          kickoff_time,
          status,
          minute,
          home_score,
          away_score,
          round,
          venue,
          home_team:home_team_id ( id, name, slug ),
          away_team:away_team_id ( id, name, slug ),
          season:season_id (
            id,
            name,
            competition:competition_id ( id, name, slug, region )
          )
        `
        )
        .eq("match_date", dayISO)
        .order("kickoff_time", { ascending: true });

      if (error) {
        console.error("Error loading matches:", error);
        setBlocks([]);
        setLoadError(error.message ?? "Unknown error");
        setLoading(false);
        return;
      }

      const rows = (data || []) as unknown as DbMatchRow[];

      const map = new Map<string, LeagueBlock>();

      for (const r of rows) {
        const compName = r.season?.competition?.name ?? "Unknown Competition";
        const region = r.season?.competition?.region ?? "";

        const kickoff = r.kickoff_time ? r.kickoff_time.slice(0, 5) : "";
        const timeLabel =
          r.status === "LIVE"
            ? `LIVE ${r.minute ?? ""}${r.minute ? "'" : ""}`.trim()
            : r.status === "FT"
            ? "FT"
            : kickoff || "TBD";

        const match: Match = {
          timeLabel,
          home: r.home_team?.name ?? "TBD",
          away: r.away_team?.name ?? "TBD",
          hs: r.home_score ?? 0,
          as: r.away_score ?? 0,
          status: r.status,
        };

        if (!map.has(compName)) {
          map.set(compName, { league: compName, region, matches: [] });
        }
        map.get(compName)!.matches.push(match);
      }

      setBlocks(Array.from(map.values()));
      setLoading(false);

      console.log("Loaded matches rows:", rows.length, "for date:", dayISO);
    };

    load();
  }, [selectedDate]);

  // Sidebar leagues reales
  const leagues = useMemo(() => ["All", ...blocks.map((x) => x.league)], [blocks]);

  // Apply league + tab filters
  const filteredBlocks = useMemo(() => {
    let blocksFiltered = blocks;

    if (selectedLeague !== "All") {
      blocksFiltered = blocksFiltered.filter((b) => b.league === selectedLeague);
    }

    if (tab === "LIVE") {
      blocksFiltered = blocksFiltered
        .map((b) => ({ ...b, matches: b.matches.filter((m) => m.status === "LIVE") }))
        .filter((b) => b.matches.length > 0);
    }

    return blocksFiltered;
  }, [blocks, selectedLeague, tab]);

  return (
    <div
      className="
        min-h-screen transition-colors duration-300
        bg-gradient-to-br
        from-emerald-500 via-green-600 to-emerald-400
        dark:bg-black dark:from-black dark:via-black dark:to-black
        text-neutral-900 dark:text-white
      "
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow" />
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-white/60">Live scores • Fixtures • Tables</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setTab("ALL")}
              className={`px-3 py-2 rounded-full text-sm border transition ${
                tab === "ALL"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              }`}
            >
              All
            </button>

            <button
              onClick={() => setTab("LIVE")}
              className={`px-3 py-2 rounded-full text-sm border transition ${
                tab === "LIVE"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              }`}
            >
              Live
            </button>

            <button
              onClick={() => setDark((v) => !v)}
              className="ml-2 px-3 py-2 rounded-full text-sm border transition
              bg-white/80 border-neutral-200 hover:bg-white
              dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
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
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950">
          <div className="text-sm font-semibold mb-3 text-neutral-700 dark:text-white/80">Leagues</div>

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
                      : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                  }`}
                >
                  {x}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 dark:bg-emerald-500/10">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Rugby vibe</div>
            <div className="text-xs text-neutral-700 dark:text-white/70 mt-1">
              Real data from Supabase • fast filters • clean UI.
            </div>
          </div>
        </aside>

        {/* Boards */}
        <section className="space-y-4">
          {/* Header + Date nav */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Matches</h2>
              <p className="text-sm text-neutral-700 dark:text-white/60">
                Date: <span className="font-semibold">{niceDate(selectedDate)}</span> • Showing: {selectedLeague} •{" "}
                {tab === "LIVE" ? "Live only" : "All matches"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                className="px-3 py-2 rounded-full text-sm border transition bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              >
                ← Prev
              </button>

              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-3 py-2 rounded-full text-sm border transition bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              >
                Today
              </button>

              <button
                onClick={() => setSelectedDate((d) => addDays(d, +1))}
                className="px-3 py-2 rounded-full text-sm border transition bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Loading / error / empty / list */}
          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              Loading real matches...
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
              <div className="font-bold">Supabase error</div>
              <div className="mt-2 text-sm opacity-80">{loadError}</div>
              <div className="mt-3 text-xs opacity-70">
                Si esto habla de “relationship” o “join”, es porque falta una FK (o el nombre de columna no coincide).
              </div>
            </div>
          ) : filteredBlocks.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              No matches found for this day / filter.
            </div>
          ) : (
            filteredBlocks.map((block) => (
              <div
                key={block.league}
                className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur overflow-hidden dark:border-white/10 dark:bg-neutral-950"
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
                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
                          <span className="font-medium">{m.home}</span>
                          <span className="font-extrabold tabular-nums">{m.hs}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
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
