// app/leagues/[slug]/LeagueClient.tsx
// Cambios: hora/timeLabel MÁS GRANDE + EN NEGRITA (y un poquito más “visible”)
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
  const dt = new Date(`${match_date}T${t}Z`);
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

// Score helper: upcoming matches should show "—" not "0 - 0"
function formatScore(status: MatchStatus, hs: number | null, as: number | null) {
  if (status === "NS" && hs == null && as == null) return "—";
  const home = hs ?? 0;
  const away = as ?? 0;
  return `${home} - ${away}`;
}

// ---------- i18n ----------
type Lang = "en" | "es" | "fr";

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    leagues: "Leagues",
    league: "League",
    season: "Season",
    round: "Round",
    standings: "Standings",
    loadingLeague: "Loading league...",
    loadingMatches: "Loading matches...",
    noMatchesSeason: "No matches loaded for this season yet.",
    noMatchesRound: "No matches in this round.",
    comingSoon: "Coming soon.",
    tz: "TZ",
    builtBy: "Built by",
    contact: "Contact",
  },
  es: {
    leagues: "Ligas",
    league: "Liga",
    season: "Temporada",
    round: "Fecha",
    standings: "Tabla",
    loadingLeague: "Cargando liga...",
    loadingMatches: "Cargando partidos...",
    noMatchesSeason: "Todavía no hay partidos cargados para esta temporada.",
    noMatchesRound: "No hay partidos en esta fecha.",
    comingSoon: "Próximamente.",
    tz: "TZ",
    builtBy: "Hecho por",
    contact: "Contacto",
  },
  fr: {
    leagues: "Ligues",
    league: "Ligue",
    season: "Saison",
    round: "Journée",
    standings: "Classement",
    loadingLeague: "Chargement de la ligue...",
    loadingMatches: "Chargement des matchs...",
    noMatchesSeason: "Aucun match n’est encore chargé pour cette saison.",
    noMatchesRound: "Aucun match dans cette journée.",
    comingSoon: "Bientôt disponible.",
    tz: "TZ",
    builtBy: "Créé par",
    contact: "Contact",
  },
};

export default function LeagueClient() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [lang, setLang] = useState<Lang>("en");

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [comp, setComp] = useState<Competition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  const [roundMeta, setRoundMeta] = useState<RoundMeta[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const [matches, setMatches] = useState<DbMatchRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  const [loadingLeague, setLoadingLeague] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [err, setErr] = useState("");

  const t = (key: string) => I18N[lang][key] ?? key;

  // --- TZ + Lang init + sync ---
  useEffect(() => {
    const savedTZ = localStorage.getItem("tz");
    if (savedTZ) setTimeZone(savedTZ);

    const savedLang = localStorage.getItem("lang") as Lang | null;
    if (savedLang === "en" || savedLang === "es" || savedLang === "fr") setLang(savedLang);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "tz" && e.newValue) setTimeZone(e.newValue);
      if (e.key === "lang" && e.newValue && (e.newValue === "en" || e.newValue === "es" || e.newValue === "fr")) {
        setLang(e.newValue as Lang);
      }
    };
    window.addEventListener("storage", onStorage);

    const onTZCustom = () => {
      const v = localStorage.getItem("tz");
      if (v) setTimeZone(v);
    };
    window.addEventListener("tz-change", onTZCustom as any);

    const onLangCustom = () => {
      const v = localStorage.getItem("lang");
      if (v === "en" || v === "es" || v === "fr") setLang(v);
    };
    window.addEventListener("lang-change", onLangCustom as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tz-change", onTZCustom as any);
      window.removeEventListener("lang-change", onLangCustom as any);
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
      .map(([teamId, team]) => ({ teamId, team, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 }))
      .sort((a, b) => a.team.localeCompare(b.team));

    setStandings(rows);
  }

  // --- MAIN LOAD ---
  useEffect(() => {
    const loadLeagueEverything = async () => {
      setLoadingLeague(true);
      setErr("");
      setComp(null);
      setSeason(null);
      setRoundMeta([]);
      setSelectedRound(null);
      setMatches([]);
      setStandings([]);

      if (!slug) {
        setErr("Slug is undefined (check app/leagues/[slug]/page.tsx params).");
        setLoadingLeague(false);
        return;
      }

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
        setErr(`No season found for: ${slug}`);
        setLoadingLeague(false);
        return;
      }
      setSeason(seasonData as Season);

      try {
        const meta = await fetchRoundMeta(seasonData.id);
        setRoundMeta(meta);
        if (meta.length > 0) {
          const has1 = meta.some((m) => m.round === 1);
          setSelectedRound(has1 ? 1 : meta[0].round);
        } else {
          setSelectedRound(null);
        }
      } catch (e: any) {
        setErr(e?.message ?? "Error loading rounds");
        setLoadingLeague(false);
        return;
      }

      fetchStandingsZero(seasonData.id).catch(() => {});
      setLoadingLeague(false);
    };

    loadLeagueEverything();
  }, [slug]);

  // --- matches + auto-refresh ---
  useEffect(() => {
    if (!season || selectedRound == null) return;

    let cancelled = false;
    let timer: any = null;

    const load = async () => {
      try {
        const m = await fetchMatchesForRound(season.id, selectedRound);
        if (cancelled) return;

        setMatches(m);
        setErr("");

        const hasLive = m.some((x) => x.status === "LIVE");
        const nextMs = hasLive ? 10_000 : 60_000;

        timer = setTimeout(load, nextMs);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Error loading matches");
        timer = setTimeout(load, 60_000);
      } finally {
        if (!cancelled) setLoadingMatches(false);
      }
    };

    setLoadingMatches(true);
    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [season?.id, selectedRound]);

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
        subtitle="League view"
        lang={lang}
        onLangChange={(l) => {
          setLang(l);
          localStorage.setItem("lang", l);
        }}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 xl:grid-cols-[320px_1fr_360px] gap-6">
        {/* LEFT */}
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-700 dark:text-white/80">{t("leagues")}</div>
          </div>

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

          <div className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-3 dark:bg-emerald-500/10">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Rugby vibe</div>
            <div className="text-xs text-neutral-700 dark:text-white/70 mt-1">
              {t("tz")}: <span className="font-semibold">{timeZone}</span>
              <span className="mx-2">•</span>
              {t("season")}: <span className="font-semibold">{season?.name ?? "—"}</span>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className="space-y-4 min-w-0">
          <div>
            <div className="text-sm text-neutral-700 dark:text-white/70">{t("league")}</div>
            <h1 className="text-2xl font-extrabold">{comp?.name ?? (slug as any)}</h1>
            <div className="text-sm text-neutral-700 dark:text-white/60 mt-1">
              {t("season")}: <span className="font-semibold">{season?.name ?? "—"}</span>
            </div>
          </div>

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
                aria-label="Previous round"
              >
                ←
              </button>

              <div className="px-3 py-2 rounded-full text-xs border bg-white/70 border-neutral-200 dark:bg-neutral-900 dark:border-white/10">
                {selectedRound != null ? `${t("round")} ${selectedRound}` : t("round")}
              </div>

              <button
                onClick={() => {
                  if (selectedIdx >= 0 && selectedIdx < roundsList.length - 1)
                    setSelectedRound(roundsList[selectedIdx + 1]);
                }}
                disabled={selectedIdx < 0 || selectedIdx >= roundsList.length - 1}
                className="px-3 py-2 rounded-full text-xs font-extrabold border-2 border-emerald-600
                  bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40
                  dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                aria-label="Next round"
              >
                →
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
                        aria-label={`Select round ${r}`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {loadingLeague ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              {t("loadingLeague")}
            </div>
          ) : err ? (
            <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
              <div className="font-bold">Error</div>
              <div className="mt-2 text-sm opacity-80">{err}</div>
            </div>
          ) : roundMeta.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              {t("noMatchesSeason")}
            </div>
          ) : loadingMatches ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              {t("loadingMatches")}
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              {t("noMatchesRound")}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/30 bg-white/20 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
              <div className="p-3 space-y-3">
                {matches.map((m) => {
                  const timeLabel =
                    m.status === "LIVE"
                      ? `LIVE ${m.minute ?? ""}${m.minute ? "'" : ""}`.trim()
                      : m.status === "FT"
                      ? "FT"
                      : formatKickoffInTZ(m.match_date, m.kickoff_time, timeZone);

                  return (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-white/30 bg-white/25 backdrop-blur-md shadow-sm dark:border-white/10 dark:bg-white/5 overflow-hidden"
                    >
                      <div className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-neutral-700 dark:text-white/70">
                            {formatDateShort(m.match_date)}
                          </div>

                          {/* ✅ ACÁ: hora/timeLabel más grande + en negrita */}
                          <div className="mt-0.5 text-lg sm:text-xl font-extrabold tracking-tight">
                            {timeLabel}
                          </div>

                          <div className="mt-1">
                            <StatusBadge status={m.status} />
                          </div>
                        </div>

                        <div className="text-right text-xs text-neutral-700 dark:text-white/50 shrink-0">
                          {m.venue ?? ""}
                        </div>
                      </div>

                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-stretch">
                          <div className="min-w-0 rounded-xl border border-white/30 bg-white/40 backdrop-blur-sm px-3 py-3 dark:border-white/10 dark:bg-white/10 flex items-center">
                            <span className="font-semibold text-sm sm:text-base truncate">
                              {m.home_team?.name ?? "TBD"}
                            </span>
                          </div>

                          <div className="min-w-[112px] sm:min-w-[132px] rounded-xl border border-emerald-500/60 bg-emerald-500/80 text-white px-4 py-3 flex items-center justify-center tabular-nums shadow-sm">
                            <span className="text-base sm:text-lg font-extrabold">
                              {formatScore(m.status, m.home_score, m.away_score)}
                            </span>
                          </div>

                          <div className="min-w-0 rounded-xl border border-white/30 bg-white/40 backdrop-blur-sm px-3 py-3 dark:border-white/10 dark:bg-white/10 flex items-center justify-end">
                            <span className="font-semibold text-sm sm:text-base truncate text-right">
                              {m.away_team?.name ?? "TBD"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* RIGHT */}
        <aside className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-6 dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-bold">{t("standings")}</div>
              <div className="text-xs text-neutral-700 dark:text-white/60">
                {t("season")}: {season?.name ?? "—"}
              </div>
            </div>

            {standings.length === 0 ? (
              <div className="text-sm text-neutral-700 dark:text-white/60 mt-3">{t("comingSoon")}</div>
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
              (Still 0s for now — later we compute automatically from results.)
            </div>
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-neutral-800 dark:text-white/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            RugbyNow • {t("builtBy")} <span className="font-semibold">Vito Loprestti</span> • {t("tz")}:{" "}
            <span className="font-semibold">{timeZone}</span>
          </div>
          <div className="opacity-90">
            {t("contact")}:{" "}
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
