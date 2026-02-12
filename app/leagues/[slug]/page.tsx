"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MatchStatus = "NS" | "LIVE" | "FT";

type DbMatchRow = {
  id: number;
  match_date: string; // yyyy-mm-dd
  kickoff_time: string | null; // hh:mm:ss
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

type MatchUI = {
  timeLabel: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  status: MatchStatus;
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

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function LeaguePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const [dark, setDark] = useState(false);

  // League info
  const [leagueName, setLeagueName] = useState<string>("");
  const [leagueRegion, setLeagueRegion] = useState<string>("");

  // Season + rounds
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [rounds, setRounds] = useState<number[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // Matches for round
  const [matches, setMatches] = useState<MatchUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Theme init
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // 1) Find "current" season for this competition
  // (para arrancar simple: agarramos la season más nueva por nombre desc)
  useEffect(() => {
    const loadSeason = async () => {
      setLoading(true);
      setErr("");

      // Trae la última season de esa competition
      const { data, error } = await supabase
        .from("seasons")
        .select(
          `
          id,
          name,
          competition:competition_id ( id, name, slug, region )
        `
        )
        .order("name", { ascending: false })
        .limit(20);

      if (error) {
        setErr(error.message || "Error loading seasons");
        setLoading(false);
        return;
      }

      // Filtramos por competition slug en el cliente (simple y robusto)
      const seasons = (data || []) as any[];
      const season = seasons.find((s) => s?.competition?.slug === slug);

      if (!season) {
        setErr(`No season found for competition slug: ${slug}`);
        setLoading(false);
        return;
      }

      setSeasonId(season.id);
      setLeagueName(season.competition?.name ?? slug);
      setLeagueRegion(season.competition?.region ?? "");
      setLoading(false);
    };

    loadSeason();
  }, [slug]);

  // 2) Load rounds list for that season + choose current round automatically
  useEffect(() => {
    const loadRounds = async () => {
      if (!seasonId) return;

      setLoading(true);
      setErr("");

      const { data, error } = await supabase
        .from("matches")
        .select("round, match_date")
        .eq("season_id", seasonId)
        .not("round", "is", null);

      if (error) {
        setErr(error.message || "Error loading rounds");
        setLoading(false);
        return;
      }

      const rows = (data || []) as { round: number; match_date: string }[];

      // rounds únicos (sorted)
      const uniqRounds = Array.from(new Set(rows.map((r) => r.round))).sort((a, b) => a - b);
      setRounds(uniqRounds);

      // Elegir round "actual":
      // - buscamos el round con el match_date más cercano >= hoy
      // - si no hay, usamos el último
      const t = todayISO();

      // armamos min match_date por round (para comparar)
      const minDateByRound = new Map<number, string>();
      for (const r of rows) {
        const cur = minDateByRound.get(r.round);
        if (!cur || r.match_date < cur) minDateByRound.set(r.round, r.match_date);
      }

      const futureOrToday = uniqRounds
        .map((rd) => ({ rd, d: minDateByRound.get(rd) || "9999-12-31" }))
        .filter((x) => x.d >= t)
        .sort((a, b) => a.d.localeCompare(b.d));

      const autoRound =
        futureOrToday.length > 0 ? futureOrToday[0].rd : uniqRounds.length > 0 ? uniqRounds[uniqRounds.length - 1] : null;

      setSelectedRound(autoRound);
      setLoading(false);
    };

    loadRounds();
  }, [seasonId]);

  // 3) Load matches for selected round (ALL matches of the round)
  useEffect(() => {
    const loadMatches = async () => {
      if (!seasonId || !selectedRound) return;

      setLoading(true);
      setErr("");

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
        .eq("season_id", seasonId)
        .eq("round", selectedRound)
        .order("match_date", { ascending: true })
        .order("kickoff_time", { ascending: true });

      if (error) {
        setErr(error.message || "Error loading matches");
        setMatches([]);
        setLoading(false);
        return;
      }

      const rows = (data || []) as unknown as DbMatchRow[];

      const ui: MatchUI[] = rows.map((r) => {
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

      setMatches(ui);
      setLoading(false);
    };

    loadMatches();
  }, [seasonId, selectedRound]);

  const roundIndex = useMemo(() => {
    if (!selectedRound) return -1;
    return rounds.indexOf(selectedRound);
  }, [rounds, selectedRound]);

  const canPrev = roundIndex > 0;
  const canNext = roundIndex >= 0 && roundIndex < rounds.length - 1;

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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-xs opacity-70 hover:opacity-100">
              ← Back
            </Link>
            <div className="text-xl font-extrabold tracking-tight">
              {leagueName || "League"}{" "}
              <span className="text-emerald-600 dark:text-emerald-400">{leagueRegion ? `• ${leagueRegion}` : ""}</span>
            </div>
            <div className="text-xs text-neutral-600 dark:text-white/60">
              Showing full round (Fecha) • not only today
            </div>
          </div>

          <button
            onClick={() => setDark((v) => !v)}
            className="px-3 py-2 rounded-full text-sm border transition
            bg-white/80 border-neutral-200 hover:bg-white
            dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
            title="Toggle theme"
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Round nav (Fecha) */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Fecha</h2>
            <p className="text-sm text-neutral-700 dark:text-white/60">
              {selectedRound ? (
                <>
                  Showing: <span className="font-semibold">Round {selectedRound}</span>
                </>
              ) : (
                "No rounds found"
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              disabled={!canPrev}
              onClick={() => setSelectedRound(rounds[roundIndex - 1])}
              className={`px-3 py-2 rounded-full text-sm border transition ${
                canPrev
                  ? "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                  : "opacity-40 cursor-not-allowed bg-white/60 border-neutral-200 dark:bg-neutral-900 dark:border-white/10"
              }`}
            >
              ← Fecha
            </button>

            <button
              onClick={() => {
                // vuelve a “auto” round recalculando con hoy:
                // fácil: setSelectedRound(null) y volvemos a correr el effect?
                // mejor: simplemente recargamos rounds effect forzando:
                // (hack simple) volver a setSeasonId al mismo valor
                if (seasonId) setSeasonId((x) => x);
              }}
              className="px-3 py-2 rounded-full text-sm border transition
              bg-white/80 border-neutral-200 hover:bg-white
              dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
            >
              Actual
            </button>

            <button
              disabled={!canNext}
              onClick={() => setSelectedRound(rounds[roundIndex + 1])}
              className={`px-3 py-2 rounded-full text-sm border transition ${
                canNext
                  ? "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                  : "opacity-40 cursor-not-allowed bg-white/60 border-neutral-200 dark:bg-neutral-900 dark:border-white/10"
              }`}
            >
              Fecha →
            </button>
          </div>
        </div>

        {/* Matches list */}
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
            Loading fixtures...
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
            <div className="font-bold">Error</div>
            <div className="mt-2 text-sm opacity-80">{err}</div>
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
            No matches for this round yet.
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur overflow-hidden dark:border-white/10 dark:bg-neutral-950">
            <div className="divide-y divide-neutral-200 dark:divide-white/10">
              {matches.map((m, idx) => (
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

        {/* Placeholder standings */}
        <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 dark:border-white/10 dark:bg-neutral-950">
          <div className="font-semibold">Table / Standings</div>
          <div className="text-sm text-neutral-700 dark:text-white/60 mt-1">
            Coming soon. (Después la hacemos automática con resultados + bonus points.)
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-800 dark:text-white/40">
        RugbyNow • League view (Fecha style).
      </footer>
    </div>
  );
}
