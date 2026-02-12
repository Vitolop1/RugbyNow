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

function toISODateLocal(d: Date) {
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

export default function LeaguePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const [leagueName, setLeagueName] = useState<string>(slug);
  const [region, setRegion] = useState<string>("");

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // theme
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // load by league + date
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
        .eq("season.competition.slug", slug)
        .order("kickoff_time", { ascending: true });

      if (error) {
        console.error(error);
        setMatches([]);
        setLoadError(error.message ?? "Unknown error");
        setLoading(false);
        return;
      }

      const rows = (data || []) as unknown as DbMatchRow[];

      // set header info from first row if exists
      if (rows[0]?.season?.competition?.name) setLeagueName(rows[0].season.competition.name);
      if (rows[0]?.season?.competition?.region) setRegion(rows[0].season.competition.region ?? "");

      const mapped: Match[] = rows.map((r) => {
        const kickoff = r.kickoff_time ? r.kickoff_time.slice(0, 5) : "";
        const timeLabel =
          r.status === "LIVE"
            ? `LIVE ${r.minute ?? ""}${r.minute ? "'" : ""}`.trim()
            : r.status === "FT"
            ? "FT"
            : kickoff || "TBD";

        return {
          timeLabel,
          home: r.home_team?.name ?? "TBD",
          away: r.away_team?.name ?? "TBD",
          hs: r.home_score ?? 0,
          as: r.away_score ?? 0,
          status: r.status,
        };
      });

      setMatches(mapped);
      setLoading(false);
    };

    load();
  }, [slug, selectedDate]);

  const filtered = useMemo(() => {
    if (tab !== "LIVE") return matches;
    return matches.filter((m) => m.status === "LIVE");
  }, [matches, tab]);

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
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow" />
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                <Link href="/" className="hover:underline">
                  Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
                </Link>
              </div>
              <div className="text-xs text-neutral-600 dark:text-white/60">League page</div>
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
            >
              {dark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{leagueName}</h2>
            <p className="text-sm text-neutral-700 dark:text-white/60">
              {region ? `${region} • ` : ""}Date: <span className="font-semibold">{niceDate(selectedDate)}</span>
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

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
            Loading matches...
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
            <div className="font-bold">Supabase error</div>
            <div className="mt-2 text-sm opacity-80">{loadError}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
            No matches for this league on this date.
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur overflow-hidden dark:border-white/10 dark:bg-neutral-950">
            <div className="divide-y divide-neutral-200 dark:divide-white/10">
              {filtered.map((m, idx) => (
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
        )}

        <div className="text-xs text-neutral-800 dark:text-white/40">
          <Link href="/" className="hover:underline">
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
