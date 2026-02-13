// app/leagues/[slug]/LeagueClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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

type Competition = {
  id: number;
  name: string;
  slug: string;
  region: string | null;

  country_code: string | null;
  category: string | null;
  group_name: string | null;
  sort_order: number | null;
  is_featured: boolean | null;
};

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

  position?: number;
  badge?: "champions" | "europe" | "relegation" | null;
};

type RoundMeta = {
  round: number;
  first_date: string;
  last_date: string;
  matches: number;
};

type RoundMeta2 = RoundMeta & { ft: number };

// ---------- UI ----------
function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-red-600 text-white">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "FT") {
    return (
      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-white">
        FT
      </span>
    );
  }
  return (
    <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-neutral-900 dark:text-white/80 dark:border-white/10">
      PRE
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function TeamAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/10 dark:bg-white/10 text-[11px] font-extrabold shrink-0">
      {initials(name)}
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

function formatScore(status: MatchStatus, hs: number | null, as: number | null) {
  if (status === "NS" && hs == null && as == null) return "—";
  const home = hs ?? 0;
  const away = as ?? 0;
  return `${home} - ${away}`;
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pickAutoRound(meta: RoundMeta2[], refISO: string) {
  if (!meta.length) return null;
  const rounds = meta.slice().sort((a, b) => a.round - b.round);

  const i = rounds.findIndex((r) => r.first_date <= refISO && refISO <= r.last_date);
  if (i !== -1) {
    const cur = rounds[i];
    const isComplete = cur.ft >= cur.matches;
    const isPast = refISO > cur.last_date;
    if (isComplete && isPast && rounds[i + 1]) return rounds[i + 1].round;
    return cur.round;
  }

  const next = rounds.find((r) => r.first_date >= refISO);
  if (next) return next.round;

  const lastIncomplete = rounds.slice().reverse().find((r) => r.ft < r.matches);
  return (lastIncomplete ?? rounds[rounds.length - 1]).round;
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
    playoffs: "Playoffs",
    relegation: "Relegation",
    computedFromFT: "Computed from FT matches",
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
    playoffs: "Playoffs",
    relegation: "Descenso",
    computedFromFT: "Calculado desde partidos FT",
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
    playoffs: "Playoffs",
    relegation: "Relégation",
    computedFromFT: "Calculé depuis les matchs FT",
  },
};

// ---------- Standings rules (frontend) ----------
const STANDINGS_RULES: Record<string, { topChampions?: number; topEurope?: number; bottomRelegation?: number } | undefined> =
  {
    "en-premiership": { topChampions: 4, bottomRelegation: 1 },
    // "fr-top14": { topChampions: 6, bottomRelegation: 1 },
    // "it-serie-a-elite": { topChampions: 4, bottomRelegation: 1 },
    // "int-six-nations": { topChampions: 4 }, // si querés “title contenders”, si no, dejalo vacío
  };

// -----------------------------------
export default function LeagueClient() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const refISO = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toISODateLocal(new Date());
  const dateQuery = `?date=${refISO}`;

  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [lang, setLang] = useState<Lang>("en");

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [comp, setComp] = useState<Competition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  const [roundMeta, setRoundMeta] = useState<RoundMeta2[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const [matches, setMatches] = useState<DbMatchRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  const [loadingLeague, setLoadingLeague] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [err, setErr] = useState("");

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
        .select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured")
        .order("is_featured", { ascending: false })
        .order("group_name", { ascending: true })
        .order("sort_order", { ascending: true })
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

  async function fetchRoundMeta(seasonId: number): Promise<RoundMeta2[]> {
    const { data, error } = await supabase
      .from("matches")
      .select("round, match_date, status")
      .eq("season_id", seasonId)
      .not("round", "is", null)
      .order("match_date", { ascending: true });

    if (error) throw error;

    const map = new Map<number, { first: string; last: string; count: number; ft: number }>();
    for (const row of (data || []) as any[]) {
      const r = parseRound(row.round);
      if (r == null) continue;

      const d = row.match_date as string;
      const st = (row.status as MatchStatus) ?? "NS";

      const cur = map.get(r);
      if (!cur) map.set(r, { first: d, last: d, count: 1, ft: st === "FT" ? 1 : 0 });
      else {
        if (d < cur.first) cur.first = d;
        if (d > cur.last) cur.last = d;
        cur.count += 1;
        if (st === "FT") cur.ft += 1;
      }
    }

    return Array.from(map.entries())
      .map(([round, v]) => ({ round, first_date: v.first, last_date: v.last, matches: v.count, ft: v.ft }))
      .sort((a, b) => a.round - b.round);
  }

  // ---- standings ----
  async function fetchTeamsForSeason(seasonId: number) {
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
    return map;
  }

  function pointsForResult(home: number, away: number) {
    if (home > away) return { homePts: 4, awayPts: 0, homeW: 1, awayW: 0, d: 0 };
    if (away > home) return { homePts: 0, awayPts: 4, homeW: 0, awayW: 1, d: 0 };
    return { homePts: 2, awayPts: 2, homeW: 0, awayW: 0, d: 1 };
  }

  async function fetchStandingsComputed(seasonId: number, compSlug: string) {
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        status, home_score, away_score,
        home_team:home_team_id ( id, name ),
        away_team:away_team_id ( id, name )
      `
      )
      .eq("season_id", seasonId)
      .eq("status", "FT");

    if (error) throw error;

    const teamMap = await fetchTeamsForSeason(seasonId);
    const table = new Map<number, StandingRow>();
    for (const [id, name] of teamMap.entries()) {
      table.set(id, { teamId: id, team: name, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 });
    }

    let ftCount = 0;

    for (const r of (data || []) as any[]) {
      const ht = r.home_team;
      const at = r.away_team;
      const hs = r.home_score;
      const as = r.away_score;

      if (!ht?.id || !at?.id) continue;
      if (typeof hs !== "number" || typeof as !== "number") continue;

      ftCount += 1;

      const home = table.get(ht.id) ?? { teamId: ht.id, team: ht.name, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 };
      const away = table.get(at.id) ?? { teamId: at.id, team: at.name, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 };

      home.pj += 1;
      away.pj += 1;

      home.pf += hs;
      home.pa += as;

      away.pf += as;
      away.pa += hs;

      const res = pointsForResult(hs, as);

      home.pts += res.homePts;
      away.pts += res.awayPts;

      if (res.d === 1) {
        home.d += 1;
        away.d += 1;
      } else {
        home.w += res.homeW;
        away.w += res.awayW;
        home.l += res.awayW;
        away.l += res.homeW;
      }

      table.set(ht.id, home);
      table.set(at.id, away);
    }

    const rows = Array.from(table.values()).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const ad = a.pf - a.pa;
      const bd = b.pf - b.pa;
      if (bd !== ad) return bd - ad;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.team.localeCompare(b.team);
    });

    const rules = STANDINGS_RULES[compSlug];
    const total = rows.length;

    const withMeta = rows.map((r, idx) => {
      const position = idx + 1;
      let badge: StandingRow["badge"] = null;

      if (rules?.topChampions && position <= rules.topChampions) badge = "champions";
      else if (rules?.topEurope && position <= rules.topEurope) badge = "europe";

      if (rules?.bottomRelegation && position > total - rules.bottomRelegation) badge = "relegation";

      return { ...r, position, badge };
    });

    return { rows: withMeta, ftCount };
  }

  async function fetchStandingsZero(seasonId: number) {
    const teamMap = await fetchTeamsForSeason(seasonId);
    const rows: StandingRow[] = Array.from(teamMap.entries())
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
        .select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured")
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
        if (meta.length > 0) setSelectedRound(pickAutoRound(meta, refISO));
        else setSelectedRound(null);
      } catch (e: any) {
        setErr(e?.message ?? "Error loading rounds");
        setLoadingLeague(false);
        return;
      }

      try {
        const computed = await fetchStandingsComputed(seasonData.id, compData.slug);
        if (computed.ftCount > 0) setStandings(computed.rows);
        else await fetchStandingsZero(seasonData.id);
      } catch {
        fetchStandingsZero(seasonData.id).catch(() => {});
      }

      setLoadingLeague(false);
    };

    loadLeagueEverything();
  }, [slug, refISO]);

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

  // ✅ de-dup competitions
  const dedupedCompetitions = useMemo(() => {
    const pickBetter = (a: Competition, b: Competition) => {
      const af = !!a.is_featured;
      const bf = !!b.is_featured;
      if (af !== bf) return af ? a : b;

      const aso = a.sort_order ?? 9999;
      const bso = b.sort_order ?? 9999;
      if (aso !== bso) return aso < bso ? a : b;

      return a.id < b.id ? a : b;
    };

    const bySlug = new Map<string, Competition>();
    for (const c of competitions) {
      const k = (c.slug ?? "").trim().toLowerCase();
      if (!k) continue;
      if (!bySlug.has(k)) bySlug.set(k, c);
      else bySlug.set(k, pickBetter(bySlug.get(k)!, c));
    }

    const list = Array.from(bySlug.values());

    const keyOf = (c: Competition) => {
      const g = (c.group_name ?? "").trim().toLowerCase();
      const n = (c.name ?? "").trim().toLowerCase();
      const cat = (c.category ?? "").trim().toLowerCase();
      return `${g}::${cat}::${n}`;
    };

    const map = new Map<string, Competition>();
    for (const c of list) {
      const k = keyOf(c);
      if (!map.has(k)) map.set(k, c);
      else map.set(k, pickBetter(map.get(k)!, c));
    }

    return Array.from(map.values());
  }, [competitions]);

  // --- folders ---
  const groupedCompetitions = useMemo(() => {
    const map = new Map<string, Competition[]>();

    for (const c of dedupedCompetitions) {
      const group = c.group_name?.trim() || "Other";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(c);
    }

    const entries = Array.from(map.entries());

    entries.sort((a, b) => {
      const aFeat = a[1].some((x) => x.is_featured);
      const bFeat = b[1].some((x) => x.is_featured);
      if (aFeat !== bFeat) return aFeat ? -1 : 1;
      return a[0].localeCompare(b[0]);
    });

    for (const [, comps] of entries) {
      comps.sort((x, y) => {
        const xf = !!x.is_featured;
        const yf = !!y.is_featured;
        if (xf !== yf) return xf ? -1 : 1;

        const xs = x.sort_order ?? 9999;
        const ys = y.sort_order ?? 9999;
        if (xs !== ys) return xs - ys;

        return x.name.localeCompare(y.name);
      });
    }

    return entries;
  }, [dedupedCompetitions]);

  useEffect(() => {
    const g = comp?.group_name?.trim();
    if (!g) return;
    setOpenGroups((prev) => ({ ...prev, [g]: true }));
  }, [comp?.group_name]);

  const roundsList = useMemo(() => roundMeta.map((m) => m.round), [roundMeta]);
  const selectedIdx = useMemo(() => {
    if (selectedRound == null) return -1;
    return roundsList.indexOf(selectedRound);
  }, [roundsList, selectedRound]);

  const hasStandingsRules = !!STANDINGS_RULES[comp?.slug ?? ""];

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-green-300 via-green-600 to-green-400 dark:bg-black dark:from-black dark:via-black dark:to-black text-neutral-900 dark:text-white">
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

      {/* ✅ layout más ancho + standings más ancho */}
      <main className="mx-auto max-w-[1500px] px-4 sm:px-6 py-6 grid grid-cols-1 xl:grid-cols-[360px_1fr_560px] gap-6">
        {/* LEFT */}
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-700 dark:text-white/80">{t("leagues")}</div>
          </div>

          <div className="space-y-3">
            {groupedCompetitions.map(([groupName, comps]) => {
              const open = openGroups[groupName] ?? (groupName === (comp?.group_name?.trim() || ""));
              const featuredCount = comps.filter((x) => x.is_featured).length;

              return (
                <div
                  key={groupName}
                  className="rounded-xl border border-neutral-200 bg-white/70 dark:border-white/10 dark:bg-neutral-900/40 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenGroups((p) => ({ ...p, [groupName]: !open }))}
                    className="w-full px-3 py-2 flex items-center justify-between text-left"
                    aria-label={`Toggle group ${groupName}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate">{groupName}</div>
                      <div className="text-[11px] opacity-70">
                        {comps.length} leagues{featuredCount ? ` • ${featuredCount} featured` : ""}
                      </div>
                    </div>
                    <span className="text-xs opacity-70">{open ? "−" : "+"}</span>
                  </button>

                  {open ? (
                    <div className="px-2 pb-2 space-y-2">
                      {comps.map((c) => (
                        <Link
                          key={`${c.slug}-${c.id}`}
                          href={`/leagues/${c.slug}${dateQuery}`}
                          className={`block w-full px-3 py-2 rounded-xl border transition ${
                            c.slug === slug
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white border-neutral-200 hover:bg-white/90 dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold truncate">{c.name}</div>
                            {c.is_featured ? (
                              <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-600 text-white">
                                PIN
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs opacity-70">
                            {c.region ?? ""}
                            {c.category ? ` • ${c.category}` : ""}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
                onClick={() => selectedIdx > 0 && setSelectedRound(roundsList[selectedIdx - 1])}
                disabled={selectedIdx <= 0}
                className="px-3 py-2 rounded-full text-xs border transition disabled:opacity-40
                  bg-white/80 border-neutral-200 hover:bg-white
                  dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
              >
                ←
              </button>

              <div className="px-3 py-2 rounded-full text-xs border bg-white/70 border-neutral-200 dark:bg-neutral-900 dark:border-white/10">
                {selectedRound != null ? `${t("round")} ${selectedRound}` : t("round")}
              </div>

              <button
                onClick={() =>
                  selectedIdx >= 0 &&
                  selectedIdx < roundsList.length - 1 &&
                  setSelectedRound(roundsList[selectedIdx + 1])
                }
                disabled={selectedIdx < 0 || selectedIdx >= roundsList.length - 1}
                className="px-3 py-2 rounded-full text-xs font-extrabold border-2 border-emerald-600
                  bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40
                  dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
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
                      {/* ✅ más compacto */}
                      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-neutral-700 dark:text-white/70">{formatDateShort(m.match_date)}</div>
                          <div className="mt-0.5 text-lg sm:text-xl font-extrabold tracking-tight">{timeLabel}</div>
                        </div>
                        <div className="text-right text-xs text-neutral-700 dark:text-white/50 shrink-0">{m.venue ?? ""}</div>
                      </div>

                      {/* ✅ badge arriba del score (y achica alto total) */}
                      <div className="px-4 pb-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-stretch">
                          <div className="min-w-0 rounded-xl border border-white/30 bg-white/40 backdrop-blur-sm px-3 py-2 dark:border-white/10 dark:bg-white/10 flex items-center gap-2">
                            {m.home_team?.name ? <TeamAvatar name={m.home_team.name} /> : null}
                            <span className="font-semibold text-sm sm:text-base truncate">{m.home_team?.name ?? "TBD"}</span>
                          </div>

                          <div className="min-w-[118px] sm:min-w-[140px] rounded-xl border border-emerald-500/60 bg-emerald-500/80 text-white px-3 py-2 flex flex-col items-center justify-center tabular-nums shadow-sm">
                            <div className="mb-1">
                              <StatusBadge status={m.status} />
                            </div>
                            <div className="text-base sm:text-lg font-extrabold">{formatScore(m.status, m.home_score, m.away_score)}</div>
                          </div>

                          <div className="min-w-0 rounded-xl border border-white/30 bg-white/40 backdrop-blur-sm px-3 py-2 dark:border-white/10 dark:bg-white/10 flex items-center justify-end gap-2">
                            <span className="font-semibold text-sm sm:text-base truncate text-right">{m.away_team?.name ?? "TBD"}</span>
                            {m.away_team?.name ? <TeamAvatar name={m.away_team.name} /> : null}
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
          {/* ✅ más ancho + entra todo */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-bold">{t("standings")}</div>
              <div className="text-xs text-neutral-700 dark:text-white/60">
                {t("season")}: {season?.name ?? "—"}
              </div>
            </div>

            {standings.length === 0 ? (
              <div className="text-sm text-neutral-700 dark:text-white/60 mt-3">{t("comingSoon")}</div>
            ) : (
              <>
                {hasStandingsRules ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-1 rounded-full bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 border border-emerald-600/25">
                      {t("playoffs")}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-red-600/15 text-red-800 dark:text-red-200 border border-red-600/25">
                      {t("relegation")}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 opacity-80">
                      {t("computedFromFT")}
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 text-[11px] opacity-70">{t("computedFromFT")}</div>
                )}

                <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-900">
                  {/* ✅ min-width para que no se aplaste */}
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="text-xs text-neutral-700 dark:text-white/60">
                      <tr>
                        <th className="text-left py-3 pr-2 w-[44px]">#</th>
                        <th className="text-left py-3">Team</th>
                        <th className="text-right py-3 w-[52px]">PJ</th>
                        <th className="text-right py-3 w-[52px]">W</th>
                        <th className="text-right py-3 w-[52px]">D</th>
                        <th className="text-right py-3 w-[52px]">L</th>
                        <th className="text-right py-3 w-[60px]">PF</th>
                        <th className="text-right py-3 w-[60px]">PA</th>
                        <th className="text-right py-3 w-[64px]">PTS</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-neutral-200 dark:divide-white/10">
                      {standings.map((r) => {
                        const rowClass =
                          r.badge === "champions"
                            ? "bg-emerald-600/10"
                            : r.badge === "relegation"
                            ? "bg-red-600/10"
                            : "";

                        return (
                          <tr key={r.teamId} className={rowClass}>
                            <td className="py-3 pr-2 text-xs opacity-70 tabular-nums">{r.position ?? ""}</td>
                            <td className="py-3 font-medium">
                              <div className="flex items-center gap-2 min-w-0">
                                <TeamAvatar name={r.team} />
                                <span className="truncate">{r.team}</span>

                                {r.badge === "champions" ? (
                                  <span className="ml-1 text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-600 text-white">
                                    TOP
                                  </span>
                                ) : null}
                                {r.badge === "relegation" ? (
                                  <span className="ml-1 text-[10px] font-extrabold px-2 py-1 rounded-full bg-red-600 text-white">
                                    DOWN
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 text-right tabular-nums">{r.pj}</td>
                            <td className="py-3 text-right tabular-nums">{r.w}</td>
                            <td className="py-3 text-right tabular-nums">{r.d}</td>
                            <td className="py-3 text-right tabular-nums">{r.l}</td>
                            <td className="py-3 text-right tabular-nums">{r.pf}</td>
                            <td className="py-3 text-right tabular-nums">{r.pa}</td>
                            <td className="py-3 text-right font-extrabold tabular-nums">{r.pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="text-xs text-neutral-700 dark:text-white/50 mt-3">(Si una liga todavía no tiene FT, te muestra equipos con 0s.)</div>
          </div>
        </aside>
      </main>

      <footer className="mx-auto max-w-[1500px] px-4 sm:px-6 py-8 text-xs text-neutral-800 dark:text-white/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            RugbyNow • {t("builtBy")} <span className="font-semibold">Vito Loprestti</span> • {t("tz")}:{" "}
            <span className="font-semibold">{timeZone}</span>
          </div>
          <div className="opacity-90">
            {t("contact")}:{" "}
            <a className="underline" href="mailto:lopresttivito@gmail.com">
              lopresttivito@gmail.com
            </a>
            <span className="mx-2">•</span>
            <a className="underline" href="https://www.linkedin.com/in/vitolopresttivito/" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
