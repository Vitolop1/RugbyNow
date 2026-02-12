// app/leagues/[slug]/LeagueClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

type RoundMeta = {
  round: number;
  first_date: string;
  last_date: string;
  matches: number;
};

// ---------- UI ----------
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

// ---------- Helpers ----------
function formatDateShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatKickoffInTZ(match_date: string, kickoff_time: string | null, timeZone: string) {
  if (!kickoff_time) return "TBD";
  const t = kickoff_time.length === 5 ? `${kickoff_time}:00` : kickoff_time;
  const dt = new Date(`${match_date}T${t}Z`); // interpret stored time as UTC
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }).format(dt);
}

function parseRound(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeSlug(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  if (typeof raw === "string") return raw;
  return null;
}

export default function LeagueClient() {
  const params = useParams();
  const slug = normalizeSlug((params as any)?.slug);

  const [timeZone, setTimeZone] = useState<string>("America/New_York");

  // sidebar leagues
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  // current league
  const [comp, setComp] = useState<Competition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  // rounds meta + selected round
  const [roundMeta, setRoundMeta] = useState<RoundMeta[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  // matches + standings
  const [matches, setMatches] = useState<DbMatchRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  // loading / errors (separados para no pisarse)
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [leagueErr, setLeagueErr] = useState("");
  const [matchesErr, setMatchesErr] = useState("");

  // --- TZ init + sync ---
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

  // --- sidebar competitions ---
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

  // --- queries ---
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

  async function fetchRoundMeta(seasonId: number): Promise<RoundMeta[]> {
    const { data, error } = await supabase
      .from("matches")
      .select("round, match_date")
      .eq("season_id", seasonId)
      .not("round", "is", null)
      .order("match_date", { ascending: true });

    if (error) throw error;

    const map = new Map<number, { first: string; last: string; count: number }>();

    for (const row of (data || []) as any[]) {
      const r = parseRound(row.round);
      if (r == null) continue;

      const d = row.match_date as string;
      const cur = map.get(r);
      if (!cur) map.set(r, { first: d, last: d, count: 1 });
      else {
        if (d < cur.first) cur.first = d;
        if (d > cur.last) cur.last = d;
        cur.count += 1;
      }
    }

    return Array.from(map.entries())
      .map(([round, v]) => ({ round, first_date: v.first, last_date: v.last, matches: v.count }))
      .sort((a, b) => a.round - b.round);
  }

  async function fetchStandingsZero(seasonId: number) {
    const { data, error } = await supabase
      .from("matches")
      .select(`home_team:home_team_id ( id, name ), away_team:away_team_id ( id, name )`)
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

  async function pickBestSeason(competitionId: number): Promise<Season | null> {
    const { data: seasons, error } = await supabase
      .from("seasons")
      .select("id,name,competition_id")
      .eq("competition_id", competitionId)
      .order("name", { ascending: false });

    if (error || !seasons?.length) return null;

    // 1) elegí la primera season que tenga al menos 1 match
    for (const s of seasons as Season[]) {
      const { count } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("season_id", s.id);

      if ((count ?? 0) > 0) return s;
    }

    // 2) fallback: la “latest” por nombre igual
    return seasons[0] as Season;
  }

  // --- MAIN LOAD: comp + season + roundMeta + default round ---
  useEffect(() => {
    let cancel = false;

    const loadLeagueEverything = async () => {
      setLoadingLeague(true);
      setLeagueErr("");
      setMatchesErr("");

      setComp(null);
      setSeason(null);
      setRoundMeta([]);
      setSelectedRound(null);
      setMatches([]);
      setStandings([]);

      if (!slug) {
        setLeagueErr("Slug is undefined (check app/leagues/[slug]/page.tsx params).");
        setLoadingLeague(false);
        return;
      }

      const { data: compData, error: compErr } = await supabase
        .from("competitions")
        .select("id,name,slug,region")
        .eq("slug", slug)
        .maybeSingle();

      if (cancel) return;

      if (compErr || !compData) {
        setLeagueErr(`No competition found for slug: ${slug}`);
        setLoadingLeague(false);
        return;
      }
      setComp(compData as Competition);

      const bestSeason = await pickBestSeason(compData.id);

      if (cancel) return;

      if (!bestSeason) {
        setLeagueErr(`No season found for: ${slug}`);
        setLoadingLeague(false);
        return;
      }
      setSeason(bestSeason);

      try {
        const meta = await fetchRoundMeta(bestSeason.id);
        if (cancel) return;

        setRoundMeta(meta);
        if (meta.length > 0) {
          const has1 = meta.some((m) => m.round === 1);
          setSelectedRound(has1 ? 1 : meta[0].round);
        } else {
          setSelectedRound(null);
        }
      } catch (e: any) {
        if (cancel) return;
        setLeagueErr(e?.message ?? "Error loading rounds");
        setLoadingLeague(false);
        return;
      }

      fetchStandingsZero(bestSeason.id).catch(() => {});
      setLoadingLeague(false);
    };

    loadLeagueEverything();

    return () => {
      cancel = true;
    };
  }, [slug]);

  // --- Load matches when selectedRound changes ---
  useEffect(() => {
    let cancel = false;

    const run = async () => {
      if (!season || selectedRound == null) return;
      setLoadingMatches(true);
      setMatchesErr("");

      try {
        const m = await fetchMatchesForRound(season.id, selectedRound);
        if (cancel) return;
        setMatches(m);
      } catch (e: any) {
        if (cancel) return;
        setMatchesErr(e?.message ?? "Error loading matches");
        setMatches([]);
      }

      if (!cancel) setLoadingMatches(false);
    };

    run();
    return () => {
      cancel = true;
    };
  }, [season?.id, selectedRound]);

  // helpers for prev/next
  const roundsList = useMemo(() => roundMeta.map((m) => m.round), [roundMeta]);
  const selectedIdx = useMemo(() => {
    if (selectedRound == null) return -1;
    return roundsList.indexOf(selectedRound);
  }, [roundsList, selectedRound]);

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
            <h1 className="text-2xl font-extrabold">{comp?.name ?? slug ?? "League"}</h1>
            <div className="text-sm text-neutral-700 dark:text-white/60 mt-1">
              Season: <span className="font-semibold">{season?.name ?? "—"}</span> • Fecha{" "}
              <span className="font-semibold">{selectedRound ?? "—"}</span>
            </div>
          </div>

          {/* NAV chiquito arriba */}
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-3 dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  if (selectedIdx > 0) setSelectedRound(roundsList[selectedIdx - 1]);
                }}
                disabled={selectedIdx <= 0}
                className="px-3 py-2 rounded-full text-xs border transition disabled:opacity-40
                  bg-white/80 border-neutral-200 hover:bg-white
                  dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              >
                ← Fecha
              </button>

              <div className="px-3 py-2 rounded-full text-xs border bg-white/70 border-neutral-200 dark:bg-neutral-900 dark:border-white/10">
                {selectedRound != null ? `Fecha ${selectedRound}` : "Fecha"}
              </div>

              <button
                onClick={() => {
                  if (selectedIdx >= 0 && selectedIdx < roundsList.length - 1) setSelectedRound(roundsList[selectedIdx + 1]);
                }}
                disabled={selectedIdx < 0 || selectedIdx >= roundsList.length - 1}
                className="px-3 py-2 rounded-full text-xs font-extrabold border-2 border-emerald-600
                  bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40
                  dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Fecha →
              </button>

              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-2 justify-end min-w-max">
                  {roundsList.map((r) => {
                    const active = selectedRound === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setSelectedRound(r)}
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

          {/* Estado general */}
          {loadingLeague ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              Loading league...
            </div>
          ) : leagueErr ? (
            <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
              <div className="font-bold">Error</div>
              <div className="mt-2 text-sm opacity-80">{leagueErr}</div>
            </div>
          ) : roundMeta.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              No matches loaded for this season yet.
              <div className="mt-2 text-xs opacity-80">
                Tip: si una liga/season todavía no tiene partidos en la tabla matches, no vas a ver Fechas.
              </div>
            </div>
          ) : (
            <>
              {/* Tabla de Fechas */}
              <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-6 dark:border-white/10 dark:bg-neutral-950">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-bold">Fechas</div>
                  <div className="text-xs text-neutral-700 dark:text-white/60">Season: {season?.name ?? "—"}</div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-neutral-700 dark:text-white/60">
                      <tr>
                        <th className="text-left py-2">Fecha</th>
                        <th className="text-left py-2">Rango</th>
                        <th className="text-right py-2">PJ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                      {roundMeta.map((r) => {
                        const active = selectedRound === r.round;
                        return (
                          <tr key={r.round} className={active ? "bg-emerald-600/10" : ""}>
                            <td className="py-2">
                              <button
                                onClick={() => setSelectedRound(r.round)}
                                className={`px-3 py-1 rounded-full text-xs border transition ${
                                  active
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                                }`}
                              >
                                #{r.round}
                              </button>
                            </td>
                            <td className="py-2 text-xs">
                              {r.first_date} → {r.last_date}
                            </td>
                            <td className="py-2 text-right tabular-nums">{r.matches}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Matches */}
              {loadingMatches ? (
                <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
                  Loading matches...
                </div>
              ) : matchesErr ? (
                <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
                  <div className="font-bold">Error loading matches</div>
                  <div className="mt-2 text-sm opacity-80">{matchesErr}</div>
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

              {/* Standings (0 por ahora) */}
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
            </>
          )}
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
