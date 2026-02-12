// app/leagues/[slug]/LeagueClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/app/components/AppHeader";

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

type StandingRow = {
  teamId: number;
  team: string;
  pj: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pts: number;
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

function formatDateShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatKickoffInTZ(match_date: string, kickoff_time: string | null, timeZone: string) {
  if (!kickoff_time) return "TBD";
  const t = kickoff_time.length === 5 ? `${kickoff_time}:00` : kickoff_time;
  const dt = new Date(`${match_date}T${t}Z`);
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }).format(dt);
}

export default function LeagueClient({ slug }: { slug: string }) {
  const [timeZone, setTimeZone] = useState<string>("America/New_York");

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [comp, setComp] = useState<Competition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  const [rounds, setRounds] = useState<number[]>([]);
  const [roundIdx, setRoundIdx] = useState<number>(0);

  const [matches, setMatches] = useState<DbMatchRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("tz");
    if (saved) setTimeZone(saved);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "tz" && e.newValue) setTimeZone(e.newValue);
    };
    window.addEventListener("storage", onStorage);

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
    const clamped = Math.min(Math.max(roundIdx, 0), rounds.length - 1);
    return rounds[clamped];
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

  async function fetchStandingsZero(seasonId: number) {
    // Trae equipos únicos del season (con un query liviano)
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `
      )
      .eq("season_id", seasonId);

    if (error) throw error;

    const map = new Map<number, string>();
    for (const r of (data || []) as any[]) {
      if (r.home_team?.id) map.set(r.home_team.id, r.home_team.name);
      if (r.away_team?.id) map.set(r.away_team.id, r.away_team.name);
    }

    const rows: StandingRow[] = Array.from(map.entries())
      .map(([teamId, team]) => ({
        teamId,
        team,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
      }))
      .sort((a, b) => a.team.localeCompare(b.team));

    setStandings(rows);
  }

  useEffect(() => {
    const loadLeagueEverything = async () => {
      setLoading(true);
      setErr("");
      setComp(null);
      setSeason(null);
      setRounds([]);
      setRoundIdx(0);
      setMatches([]);
      setStandings([]);

      // IMPORTANTÍSIMO: si slug viene undefined, el page.tsx está mal
      if (!slug) {
        setErr("Slug is undefined (check app/leagues/[slug]/page.tsx params).");
        setLoading(false);
        return;
      }

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

      // latest season (por ahora)
      const { data: seasonData, error: seasonErr } = await supabase
        .from("seasons")
        .select("id,name,competition_id")
        .eq("competition_id", compData.id)
        .order("name", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seasonErr || !seasonData) {
        setErr(`No season found for: ${slug}`);
        setLoading(false);
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

      if (!uniq.length) {
        setErr("No rounds found for this season.");
        setLoading(false);
        return;
      }

      setRounds(uniq);

      // arrancar SIEMPRE en round 1 si existe
      const defaultIndex = uniq.includes(1) ? uniq.indexOf(1) : 0;
      setRoundIdx(defaultIndex);

      // standings (todo 0 por ahora)
      try {
        await fetchStandingsZero(seasonData.id);
      } catch (e: any) {
        // no lo matamos si falla
        console.log("Standings error:", e?.message);
      }

      setLoading(false);
    };

    loadLeagueEverything();
  }, [slug]);

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
  }, [season?.id, currentRound]);

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-green-500 via-green-600 to-green-600 dark:bg-black dark:from-black dark:via-black dark:to-black text-neutral-900 dark:text-white">
      <AppHeader
        title={
          <>
            Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
          </>
        }
        subtitle="League view • Fecha (round) style"
      />

      {/* IMPORTANT: para que el zoom “apile” antes, pasamos el 2-col a XL */}
      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950 space-y-4">
          <div>
            <div className="text-sm font-semibold mb-2 text-neutral-700 dark:text-white/80">Ligas</div>
            <div className="space-y-2">
              {competitions.map((c) => (
                <Link
                  key={c.slug}
                  href={`/leagues/${c.slug}`}
                  className={`block w-full px-3 py-2 rounded-xl border transition ${
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

          <div className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 dark:bg-emerald-500/10">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Rugby vibe</div>
            <div className="text-xs text-neutral-700 dark:text-white/70 mt-1">
              TZ: <span className="font-semibold">{timeZone}</span>
              <span className="mx-2">•</span>
              Season: <span className="font-semibold">{season?.name ?? "—"}</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <section className="space-y-4 min-w-0">
          <div>
            <div className="text-sm text-neutral-700 dark:text-white/70">League</div>
            <h1 className="text-2xl font-extrabold">{comp?.name ?? slug}</h1>
            <div className="text-sm text-neutral-700 dark:text-white/60 mt-1">
              Season: <span className="font-semibold">{season?.name ?? "—"}</span> • Fecha{" "}
              <span className="font-semibold">{currentRound ?? "—"}</span>
            </div>
          </div>

          {/* NAV CHIQUITO ARRIBA DE LOS PARTIDOS */}
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-3 dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setRoundIdx((i) => Math.max(0, i - 1))}
                disabled={roundIdx <= 0}
                className="px-3 py-2 rounded-full text-xs border transition disabled:opacity-40
                  bg-white/80 border-neutral-200 hover:bg-white
                  dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              >
                ← Fecha
              </button>

              <div className="px-3 py-2 rounded-full text-xs border bg-white/70 border-neutral-200 dark:bg-neutral-900 dark:border-white/10">
                {currentRound != null ? `Fecha ${currentRound}` : "Fecha"}
              </div>

              <button
                onClick={() => setRoundIdx((i) => Math.min(rounds.length - 1, i + 1))}
                disabled={roundIdx >= rounds.length - 1}
                className="px-3 py-2 rounded-full text-xs font-extrabold border-2 border-emerald-600
                  bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40
                  dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Fecha →
              </button>

              {/* pills horizontales opcional, re cómodo */}
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-2 justify-end min-w-max">
                  {rounds.map((r, idx) => {
                    const active = currentRound === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setRoundIdx(idx)}
                        className={`px-3 py-2 rounded-full text-xs border transition ${
                          active
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* MATCHES */}
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
                      <div className="w-28 shrink-0">
                        <div className="text-xs text-neutral-700 dark:text-white/70">{formatDateShort(m.match_date)}</div>
                        <div className="text-sm font-semibold">{timeLabel}</div>
                        <div className="mt-1">
                          <StatusBadge status={m.status} />
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
                          <span className="font-medium truncate">{m.home_team?.name ?? "TBD"}</span>
                          <span className="font-extrabold tabular-nums">{m.home_score ?? 0}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-white/80 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
                          <span className="font-medium truncate">{m.away_team?.name ?? "TBD"}</span>
                          <span className="font-extrabold tabular-nums">{m.away_score ?? 0}</span>
                        </div>
                      </div>

                      <div className="hidden lg:block w-44 text-right text-xs text-neutral-700 dark:text-white/50 shrink-0">
                        {m.venue ?? ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STANDINGS (antes decía Fechas / Table) */}
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-6 dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-bold">Standings</div>
              <div className="text-xs text-neutral-700 dark:text-white/60">Season: {season?.name ?? "—"}</div>
            </div>

            {standings.length === 0 ? (
              <div className="text-sm text-neutral-700 dark:text-white/60 mt-3">Coming soon.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-neutral-700 dark:text-white/60">
                    <tr>
                      <th className="text-left py-2">Team</th>
                      <th className="text-right py-2">PJ</th>
                      <th className="text-right py-2">W</th>
                      <th className="text-right py-2">D</th>
                      <th className="text-right py-2">L</th>
                      <th className="text-right py-2">PF</th>
                      <th className="text-right py-2">PA</th>
                      <th className="text-right py-2">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                    {standings.map((r) => (
                      <tr key={r.teamId}>
                        <td className="py-2 font-medium">{r.team}</td>
                        <td className="py-2 text-right tabular-nums">{r.pj}</td>
                        <td className="py-2 text-right tabular-nums">{r.w}</td>
                        <td className="py-2 text-right tabular-nums">{r.d}</td>
                        <td className="py-2 text-right tabular-nums">{r.l}</td>
                        <td className="py-2 text-right tabular-nums">{r.pf}</td>
                        <td className="py-2 text-right tabular-nums">{r.pa}</td>
                        <td className="py-2 text-right font-extrabold tabular-nums">{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-neutral-700 dark:text-white/50 mt-3">
              (Por ahora todos 0. Después lo hacemos automático con resultados + bonus points.)
            </div>
          </div>
        </section>
      </main>

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
