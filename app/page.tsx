"use client";

import Link from "next/link";
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
  slug: string;
  matches: Match[];
};

type Competition = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
};

type DbMatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
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

// -------- Helpers de fecha (LOCAL) --------
function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISODateLocal(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, delta: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}
function niceDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}
function isSameDay(a: Date, b: Date) {
  return toISODateLocal(a) === toISODateLocal(b);
}

export default function Home() {
  // THEME
  const [dark, setDark] = useState(false);

  // FILTERS
  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");

  // DATE
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // LEFT LISTS
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError] = useState("");

  // MATCH DATA
  const [blocks, setBlocks] = useState<LeagueBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const today = new Date();
  const selectedISO = toISODateLocal(selectedDate);

  // 1) theme init
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);

  // 2) apply theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // 3) load competitions ONCE
  useEffect(() => {
    const loadComps = async () => {
      setCompLoading(true);
      setCompError("");

      const { data, error } = await supabase
        .from("competitions")
        .select("id, name, slug, region")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading competitions:", error);
        setCompetitions([]);
        setCompError(error.message ?? "Unknown competitions error");
        setCompLoading(false);
        return;
      }

      setCompetitions((data || []) as Competition[]);
      setCompLoading(false);
    };

    loadComps();
  }, []);

  // 4) load matches for selected date
  useEffect(() => {
    const loadMatches = async () => {
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
        setLoadError(error.message ?? "Unknown matches error");
        setLoading(false);
        return;
      }

      const rows = (data || []) as unknown as DbMatchRow[];
      const map = new Map<string, LeagueBlock>();

      for (const r of rows) {
        const compName = r.season?.competition?.name ?? "Unknown Competition";
        const compSlug = r.season?.competition?.slug ?? "unknown";
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

        if (!map.has(compSlug)) {
          map.set(compSlug, { league: compName, region, slug: compSlug, matches: [] });
        }
        map.get(compSlug)!.matches.push(match);
      }

      setBlocks(Array.from(map.values()));
      setLoading(false);
    };

    loadMatches();
  }, [selectedDate]);

  // Apply LIVE filter only
  const filteredBlocks = useMemo(() => {
    if (tab !== "LIVE") return blocks;

    return blocks
      .map((b) => ({ ...b, matches: b.matches.filter((m) => m.status === "LIVE") }))
      .filter((b) => b.matches.length > 0);
  }, [blocks, tab]);

  return (
    <div
      className="
        min-h-screen transition-colors duration-300
        bg-gradient-to-br
        from-green-500 via-green-600 to-green-600
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
      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar (always visible) */}
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950 space-y-4">
          {/* Dates (UN SOLO CALENDARIO) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-neutral-700 dark:text-white/80">Fechas</div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  className="px-2 py-1 rounded-lg text-xs border bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                  aria-label="Previous day"
                >
                  ←
                </button>

                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-2 py-1 rounded-lg text-xs border bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                >
                  Today
                </button>

                <button
                  onClick={() => setSelectedDate((d) => addDays(d, +1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 border-emerald-600
                             bg-emerald-600 text-white hover:bg-emerald-700
                             dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  aria-label="Next day"
                >
                  NEXT →
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                type="date"
                value={selectedISO}
                onChange={(e) => setSelectedDate(fromISODateLocal(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-sm border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10"
              />
              <span
                className={`px-2 py-1 rounded-full text-[11px] border whitespace-nowrap ${
                  isSameDay(selectedDate, today)
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white/70 border-neutral-200 text-neutral-700 dark:bg-neutral-900 dark:border-white/10 dark:text-white/70"
                }`}
              >
                {isSameDay(selectedDate, today) ? "HOY" : "OTRO"}
              </span>
            </div>

            <div className="text-xs text-neutral-700 dark:text-white/60">
              Seleccionada: <span className="font-semibold">{niceDate(selectedDate)}</span>
            </div>
          </div>

          {/* Leagues */}
          <div>
            <div className="text-sm font-semibold mb-2 text-neutral-700 dark:text-white/80">Ligas</div>

            {compLoading ? (
              <div className="text-xs text-neutral-700 dark:text-white/60">Cargando ligas...</div>
            ) : compError ? (
              <div className="text-xs text-red-700 dark:text-red-300">{compError}</div>
            ) : (
              <div className="space-y-2">
                {competitions.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/leagues/${c.slug}`}
                    className="block w-full text-left px-3 py-2 rounded-xl border transition
                      bg-white/80 border-neutral-200 hover:bg-white
                      dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                  >
                    <div className="text-sm font-medium">{c.name}</div>
                    {c.region ? <div className="text-xs opacity-70">{c.region}</div> : null}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 dark:bg-emerald-500/10">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Rugby vibe</div>
            <div className="text-xs text-neutral-700 dark:text-white/70 mt-1">Sidebar siempre visible • calendario real</div>
          </div>
        </aside>

        {/* Main */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Matches</h2>
            <p className="text-sm text-neutral-700 dark:text-white/60">
              Date: <span className="font-semibold">{niceDate(selectedDate)}</span> •{" "}
              {tab === "LIVE" ? "Live only" : "All matches"}
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              Loading matches...
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
              <div className="font-bold">Supabase error</div>
              <div className="mt-2 text-sm opacity-80">{loadError}</div>
            </div>
          ) : filteredBlocks.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              No matches for this date (but sidebar stays 😉)
            </div>
          ) : (
            filteredBlocks.map((block) => (
              <div
                key={block.slug}
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

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-800 dark:text-white/40">RugbyNow</footer>
    </div>
  );
}
