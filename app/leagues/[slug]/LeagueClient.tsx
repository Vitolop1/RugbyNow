"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type MatchStatus = "NS" | "LIVE" | "FT";

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
};

type Competition = { id: number; name: string; slug: string; region: string | null };
type Season = { id: number; name: string; competition_id: number };

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

function formatKickoff(kickoff: string | null) {
  if (!kickoff) return "TBD";
  return kickoff.slice(0, 5);
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function LeagueClient({ slug }: { slug: string }) {
  const [dark, setDark] = useState(false);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [comp, setComp] = useState<Competition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  const [rounds, setRounds] = useState<number[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);

  // 🔥 NUEVO: modo de vista
  const [viewMode, setViewMode] = useState<"ROUND" | "ALL">("ROUND");

  const [matches, setMatches] = useState<DbMatchRow[]>([]);
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [err, setErr] = useState("");

  // theme
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // sidebar comps
  useEffect(() => {
    const loadComps = async () => {
      const { data } = await supabase.from("competitions").select("id,name,slug,region").order("name");
      setCompetitions((data || []) as Competition[]);
    };
    loadComps();
  }, []);

  // load comp + season + rounds
  useEffect(() => {
    const loadLeague = async () => {
      setLoadingLeague(true);
      setErr("");
      setComp(null);
      setSeason(null);
      setRounds([]);
      setRoundIdx(0);
      setMatches([]);
      setViewMode("ROUND");

      const { data: compData, error: compErr } = await supabase
        .from("competitions")
        .select("id,name,slug,region")
        .eq("slug", slug)
        .maybeSingle();

      if (compErr || !compData) {
        setErr(`No competition found for slug: ${slug}`);
        setLoadingLeague(false);
        return;
      }
      setComp(compData as Competition);

      const { data: seasonData, error: seasonErr } = await supabase
        .from("seasons")
        .select("id,name,competition_id")
        .eq("competition_id", compData.id)
        .order("name", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seasonErr || !seasonData) {
        setErr(`No season found for competition slug: ${slug}`);
        setLoadingLeague(false);
        return;
      }
      setSeason(seasonData as Season);

      // rounds
      const { data: roundRows, error: roundErr } = await supabase
        .from("matches")
        .select("round")
        .eq("season_id", seasonData.id)
        .not("round", "is", null)
        .order("round", { ascending: true });

      if (roundErr) {
        setErr(roundErr.message);
        setLoadingLeague(false);
        return;
      }

      const uniq = Array.from(
        new Set((roundRows || []).map((r: any) => r.round).filter((x: any) => typeof x === "number"))
      ) as number[];

      uniq.sort((a, b) => a - b);
      setRounds(uniq);

      // default: Fecha 1 si existe, si no, la primera
      if (uniq.length === 0) {
        // no rounds => forzamos ALL (así SIEMPRE ves partidos)
        setViewMode("ALL");
      } else {
        const idx = uniq.includes(1) ? uniq.indexOf(1) : 0;
        setRoundIdx(idx);
        setViewMode("ROUND");
      }

      setLoadingLeague(false);
    };

    loadLeague();
  }, [slug]);

  const currentRound = useMemo(() => {
    if (!rounds.length) return null;
    return rounds[Math.min(roundIdx, rounds.length - 1)];
  }, [rounds, roundIdx]);

  // load matches (round or all)
  useEffect(() => {
    const load = async () => {
      if (!season) return;

      setLoadingMatches(true);
      setErr("");

      let q = supabase
        .from("matches")
        .select(
          `
          id, match_date, kickoff_time, status, minute, home_score, away_score, round, venue,
          home_team:home_team_id ( id, name, slug ),
          away_team:away_team_id ( id, name, slug )
        `
        )
        .eq("season_id", season.id)
        .order("match_date", { ascending: true })
        .order("kickoff_time", { ascending: true });

      if (viewMode === "ROUND" && currentRound != null) {
        q = q.eq("round", currentRound);
      }

      const { data, error } = await q;

      if (error) {
        setErr(error.message);
        setMatches([]);
        setLoadingMatches(false);
        return;
      }

      const rows = (data || []) as unknown as DbMatchRow[];
      setMatches(rows);
      setLoadingMatches(false);

      // 🔥 fallback automático:
      // si estamos en ROUND y no hay partidos, pasamos a ALL para que se vea algo sí o sí
      if (viewMode === "ROUND" && rows.length === 0) {
        setViewMode("ALL");
      }
    };

    load();
  }, [season?.id, currentRound, viewMode]);

  const isBusy = loadingLeague || loadingMatches;

  return (
    <div
      className="
        min-h-screen transition-colors duration-300
        bg-gradient-to-br from-green-500 via-green-600 to-green-600
        dark:bg-black dark:from-black dark:via-black dark:to-black
        text-neutral-900 dark:text-white
      "
    >
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-lime-400 shadow block" />
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
              </div>
              <div className="text-xs text-neutral-600 dark:text-white/60">League view • Fecha (round) style</div>
            </div>
          </div>

          <button
            onClick={() => setDark((v) => !v)}
            className="px-3 py-2 rounded-full text-sm border transition
              bg-white/80 border-neutral-200 hover:bg-white
              dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950">
          <div className="text-sm font-semibold mb-2 text-neutral-700 dark:text-white/80">Ligas</div>
          <div className="space-y-2">
            {competitions.map((c) => (
              <Link
                key={c.slug}
                href={`/leagues/${c.slug}`}
                className={`block w-full text-left px-3 py-2 rounded-xl border transition
                ${
                  c.slug === slug
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                }`}
              >
                <div className="text-sm font-medium">{c.name}</div>
                {c.region ? <div className="text-xs opacity-70">{c.region}</div> : null}
              </Link>
            ))}
          </div>
        </aside>

        {/* Main */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="text-sm text-neutral-700 dark:text-white/70">League</div>
              <h1 className="text-2xl font-extrabold">{comp?.name ?? slug}</h1>
              <div className="text-sm text-neutral-700 dark:text-white/60 mt-1">
                {viewMode === "ROUND" && rounds.length ? "Showing full round (Fecha)" : "Showing ALL matches in season"}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Toggle ALL */}
              <button
                onClick={() => setViewMode("ALL")}
                className={`px-3 py-2 rounded-full text-sm border transition
                  ${
                    viewMode === "ALL"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                  }`}
              >
                Todos
              </button>

              {/* Round nav only if rounds exist */}
              {rounds.length ? (
                <>
                  <button
                    onClick={() => {
                      setViewMode("ROUND");
                      setRoundIdx((i) => Math.max(0, i - 1));
                    }}
                    disabled={roundIdx <= 0}
                    className="px-3 py-2 rounded-full text-sm border transition disabled:opacity-40
                      bg-white/80 border-neutral-200 hover:bg-white
                      dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                  >
                    ← Fecha
                  </button>

                  <button
                    onClick={() => setViewMode("ROUND")}
                    className={`px-4 py-2 rounded-full text-sm border transition
                      ${
                        viewMode === "ROUND"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white/70 border-neutral-200 dark:bg-neutral-900 dark:border-white/10"
                      }`}
                  >
                    {currentRound != null ? `Fecha ${currentRound}` : "Fecha"}
                  </button>

                  <button
                    onClick={() => {
                      setViewMode("ROUND");
                      setRoundIdx((i) => Math.min(rounds.length - 1, i + 1));
                    }}
                    disabled={roundIdx >= rounds.length - 1}
                    className="px-3 py-2 rounded-full text-sm font-extrabold border-2 border-emerald-600
                      bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40
                      dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    Fecha →
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {isBusy ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              Loading...
            </div>
          ) : err ? (
            <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
              <div className="font-bold">Error</div>
              <div className="mt-2 text-sm opacity-80">{err}</div>
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              No matches found.
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur overflow-hidden dark:border-white/10 dark:bg-neutral-950">
              <div className="divide-y divide-neutral-200 dark:divide-white/10">
                {matches.map((m) => {
                  const timeLabel =
                    m.status === "LIVE"
                      ? `LIVE ${m.minute ?? ""}${m.minute ? "'" : ""}`.trim()
                      : m.status === "FT"
                      ? "FT"
                      : formatKickoff(m.kickoff_time);

                  return (
                    <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="w-28">
                        <div className="text-xs text-neutral-700 dark:text-white/70">{formatDate(m.match_date)}</div>
                        <div className="text-sm font-semibold">{timeLabel}</div>
                        <div className="mt-1">
                          <StatusBadge status={m.status} />
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
                          <span className="font-medium">{m.home_team?.name ?? "TBD"}</span>
                          <span className="font-extrabold tabular-nums">{m.home_score ?? 0}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
                          <span className="font-medium">{m.away_team?.name ?? "TBD"}</span>
                          <span className="font-extrabold tabular-nums">{m.away_score ?? 0}</span>
                        </div>
                      </div>

                      <div className="hidden md:block w-44 text-right text-xs text-neutral-700 dark:text-white/50">
                        {m.venue ?? ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-6 dark:border-white/10 dark:bg-neutral-950">
            <div className="font-bold">Table / Standings</div>
            <div className="text-sm text-neutral-700 dark:text-white/60 mt-2">
              Coming soon. (Después la hacemos automática con resultados + bonus points.)
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-800 dark:text-white/40">
        RugbyNow • League view (Fecha style).
      </footer>
    </div>
  );
}
