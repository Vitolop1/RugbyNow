// app/leagues/[slug]/LeagueClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/app/components/AppHeader";

type MatchStatus = "NS" | "LIVE" | "FT";

type DbMatchRow = {
  id: number;
  match_date: string; // yyyy-mm-dd
  kickoff_time: string | null; // HH:MM:SS
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

// ------- Helpers (LOCAL + TZ) -------
function formatDateShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Interpret kickoff as UTC (Z) and format to selected timeZone
function formatKickoffInTZ(match_date: string, kickoff_time: string | null, timeZone: string) {
  if (!kickoff_time) return "TBD";
  const t = kickoff_time.length === 5 ? `${kickoff_time}:00` : kickoff_time; // ensure HH:MM:SS
  const dt = new Date(`${match_date}T${t}Z`);
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }).format(dt);
}

export default function LeagueClient({ slug }: { slug: string }) {
  // THEME (lo dejamos local por ahora; AppHeader ya guarda theme también si lo hiciste)
  const [dark, setDark] = useState(false);

  // TIMEZONE (viene del AppHeader via localStorage("tz") + sync en vivo)
  const [timeZone, setTimeZone] = useState<string>("America/New_York");

  // sidebar leagues
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  // current league
  const [comp, setComp] = useState<Competition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  // rounds + selected
  const [rounds, setRounds] = useState<number[]>([]);
  const [roundIdx, setRoundIdx] = useState<number>(0);

  // matches
  const [matches, setMatches] = useState<DbMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ---- theme init/apply ----
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // ---- timezone init + live sync (header -> leagues) ----
  useEffect(() => {
    // initial
    const saved = localStorage.getItem("tz");
    if (saved) setTimeZone(saved);

    // other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === "tz" && e.newValue) setTimeZone(e.newValue);
    };
    window.addEventListener("storage", onStorage);

    // same tab (custom event fired by AppHeader)
    const onCustom = () => {
      const v = localStorage.getItem("tz");
      if (v) setTimeZone(v);
    };
    window.addEventListener("tz-change", onCustom as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tz-change", onCustom as any);
    };
  }, []);

  // competitions for sidebar
  useEffect(() => {
    const loadComps = async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("id,name,slug,region")
        .order("name", { ascending: true });

      if (!error) setCompetitions((data || []) as Competition[]);
    };
    loadComps();
  }, []);

  const currentRound = useMemo(() => {
    if (!rounds.length) return null;
    return rounds[Math.min(Math.max(roundIdx, 0), rounds.length - 1)];
  }, [rounds, roundIdx]);

  async function fetchMatchesForRound(seasonId: number, round: number) {
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        id, match_date, kickoff_time, status, minute, home_score, away_score, round, venue,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug )
      `
      )
      .eq("season_id", seasonId)
      .eq("round", round)
      .order("match_date", { ascending: true })
      .order("kickoff_time", { ascending: true });

    if (error) throw error;
    return (data || []) as unknown as DbMatchRow[];
  }

  // MAIN LOAD: competition + latest season + rounds + default round matches
  useEffect(() => {
    const loadLeagueEverything = async () => {
      setLoading(true);
      setErr("");
      setComp(null);
      setSeason(null);
      setRounds([]);
      setRoundIdx(0);
      setMatches([]);

      // 1) competition by slug
      const { data: compData, error: compErr } = await supabase
        .from("competitions")
        .select("id,name,slug,region")
        .eq("slug", slug)
        .maybeSingle();

      if (compErr || !compData) {
        setErr(`No competition found for slug: ${slug}`);
        setLoading(false);
        return;
      }

      setComp(compData as Competition);

      // 2) latest season for that competition
      const { data: seasonData, error: seasonErr } = await supabase
        .from("seasons")
        .select("id,name,competition_id")
        .eq("competition_id", compData.id)
        .order("name", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seasonErr || !seasonData) {
        setErr(`No season found for competition slug: ${slug}`);
        setLoading(false);
        return;
      }

      setSeason(seasonData as Season);

      // 3) rounds list
      const { data: roundRows, error: roundErr } = await supabase
        .from("matches")
        .select("round")
        .eq("season_id", seasonData.id)
        .not("round", "is", null)
        .order("round", { ascending: true });

      if (roundErr) {
        setErr(roundErr.message);
        setLoading(false);
        return;
      }

      const uniq = Array.from(
        new Set(
          (roundRows || [])
            .map((r: any) => (typeof r.round === "string" ? parseInt(r.round, 10) : r.round))
            .filter((x: any) => Number.isFinite(x))
        )
      ) as number[];

      uniq.sort((a, b) => a - b);

      if (uniq.length === 0) {
        setErr("No rounds found (matches.round is null or missing for this season).");
        setLoading(false);
        return;
      }

      setRounds(uniq);

      // default = round 1 if exists else first
      const defaultIndex = uniq.includes(1) ? uniq.indexOf(1) : 0;
      setRoundIdx(defaultIndex);

      // fetch matches for default round immediately
      try {
        const round = uniq[defaultIndex];
        const m = await fetchMatchesForRound(seasonData.id, round);
        setMatches(m);
      } catch (e: any) {
        setErr(e?.message ?? "Error loading matches");
      }

      setLoading(false);
    };

    loadLeagueEverything();
  }, [slug]);

  // when round changes
  useEffect(() => {
    const run = async () => {
      if (!season || currentRound == null) return;
      setLoading(true);
      setErr("");
      try {
        const m = await fetchMatchesForRound(season.id, currentRound);
        setMatches(m);
      } catch (e: any) {
        setErr(e?.message ?? "Error loading matches");
        setMatches([]);
      }
      setLoading(false);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season?.id, currentRound]);

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
      {/* HEADER UNIFICADO */}
      <AppHeader
        title={
          <>
            Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
          </>
        }
        subtitle="League view • Fecha (round) style"
        // Si tu AppHeader soporta props para theme, pasalas; si no, ignorá esto.
      />

      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950 space-y-4">
          {/* Ligas */}
          <div>
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
          </div>

          {/* Fechas (Rounds) tipo Promiedos */}
          <div>
            <div className="text-sm font-semibold mb-2 text-neutral-700 dark:text-white/80">Fechas</div>

            {rounds.length === 0 ? (
              <div className="text-xs text-neutral-700 dark:text-white/60">Cargando fechas...</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {rounds.map((r) => {
                  const active = currentRound === r;
                  const idx = rounds.indexOf(r);
                  return (
                    <button
                      key={r}
                      onClick={() => setRoundIdx(idx)}
                      className={`rounded-xl border px-2 py-2 text-left transition ${
                        active
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <div className="text-[10px] font-semibold opacity-80">Fecha</div>
                      <div className="text-sm font-extrabold">{r}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 dark:bg-emerald-500/10">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Rugby vibe</div>
            <div className="text-xs text-neutral-700 dark:text-white/70 mt-1">
              Ligas + Fechas siempre visibles • horarios en <span className="font-semibold">{timeZone}</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <div className="text-sm text-neutral-700 dark:text-white/70">League</div>
              <h1 className="text-2xl font-extrabold">{comp?.name ?? slug}</h1>
              <div className="text-sm text-neutral-700 dark:text-white/60 mt-1">
                Season: <span className="font-semibold">{season?.name ?? "—"}</span> • Showing full round (Fecha)
              </div>
            </div>

            {/* Round nav */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRoundIdx((i) => Math.max(0, i - 1))}
                disabled={roundIdx <= 0}
                className="px-3 py-2 rounded-full text-sm border transition disabled:opacity-40
                  bg-white/80 border-neutral-200 hover:bg-white
                  dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              >
                ← Fecha
              </button>

              <div className="px-4 py-2 rounded-full text-sm border bg-white/70 border-neutral-200 dark:bg-neutral-900 dark:border-white/10">
                {currentRound != null ? `Fecha ${currentRound}` : "Fecha"}
              </div>

              <button
                onClick={() => setRoundIdx((i) => Math.min(rounds.length - 1, i + 1))}
                disabled={roundIdx >= rounds.length - 1}
                className="px-3 py-2 rounded-full text-sm font-extrabold border-2 border-emerald-600
                  bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40
                  dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Fecha →
              </button>
            </div>
          </div>

          {loading ? (
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
              No matches in this Fecha.
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
                      : formatKickoffInTZ(m.match_date, m.kickoff_time, timeZone);

                  return (
                    <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="w-28">
                        <div className="text-xs text-neutral-700 dark:text-white/70">{formatDateShort(m.match_date)}</div>
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

          {/* Table placeholder */}
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-6 dark:border-white/10 dark:bg-neutral-950">
            <div className="font-bold">Table / Standings</div>
            <div className="text-sm text-neutral-700 dark:text-white/60 mt-2">
              Coming soon. (Después la hacemos automática con resultados + bonus points.)
            </div>
          </div>
        </section>
      </main>

      {/* Footer (firma + tz) */}
      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-neutral-800 dark:text-white/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            RugbyNow • Built by <span className="font-semibold">Vito Loprestti</span> • TZ:{" "}
            <span className="font-semibold">{timeZone}</span>
          </div>
          <div className="opacity-90">
            Contact:{" "}
            <a className="underline" href="mailto:YOUR_EMAIL_HERE">
              YOUR_EMAIL_HERE
            </a>
            <span className="mx-2">•</span>
            <a className="underline" href="https://linkedin.com/in/YOUR_LINKEDIN_HERE" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
