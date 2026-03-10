"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/app/components/AppHeader";
import { usePrefs, type Lang } from "@/lib/usePrefs";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";

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

type TeamRefRow = {
  home_team: { id: number; name: string; slug: string | null } | Array<{ id: number; name: string; slug: string | null }> | null;
  away_team: { id: number; name: string; slug: string | null } | Array<{ id: number; name: string; slug: string | null }> | null;
};

type StandingMatchRow = {
  home_team: { id: number; name: string; slug: string | null } | Array<{ id: number; name: string; slug: string | null }> | null;
  away_team: { id: number; name: string; slug: string | null } | Array<{ id: number; name: string; slug: string | null }> | null;
  home_score: number | null;
  away_score: number | null;
};

type RoundQueryRow = {
  round: number | string | null;
  match_date: string;
  status: MatchStatus | null;
};

function asTeamRef(
  team: { id: number; name: string; slug: string | null } | Array<{ id: number; name: string; slug: string | null }> | null
) {
  return Array.isArray(team) ? (team[0] ?? null) : team;
}

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
  teamSlug?: string | null;
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

type RoundMeta = { round: number; first_date: string; last_date: string; matches: number };
type RoundMeta2 = RoundMeta & { ft: number };

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
    playoffs: "Playoffs",
    relegation: "Relegation",
    computedFromFT: "Computed from FT matches",
    openLeague: "Open league →",
    openLeaguesBtn: "Leagues",
    close: "Close",
    matches: "Matches",
    error: "Error",
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
    playoffs: "Playoffs",
    relegation: "Descenso",
    computedFromFT: "Calculado desde partidos FT",
    openLeague: "Abrir liga →",
    openLeaguesBtn: "Ligas",
    close: "Cerrar",
    matches: "Partidos",
    error: "Error",
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
    playoffs: "Playoffs",
    relegation: "Relégation",
    computedFromFT: "Calculé depuis les matchs FT",
    openLeague: "Ouvrir ligue →",
    openLeaguesBtn: "Ligues",
    close: "Fermer",
    matches: "Matchs",
    error: "Erreur",
  },
};

const STANDINGS_RULES: Record<
  string,
  { topChampions?: number; topEurope?: number; bottomRelegation?: number } | undefined
> = {
  "en-premiership": { topChampions: 4, bottomRelegation: 1 },
  "en-premiership-rugby": { topChampions: 4, bottomRelegation: 1 },
};

function LeagueLogo({
  slug,
  alt,
  size = 20,
  fallback = "/league-logos/_placeholder.png",
}: {
  slug?: string | null;
  alt: string;
  size?: number;
  fallback?: string;
}) {
  return (
    <img
      src={getLeagueLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="object-contain shrink-0 rounded-sm bg-white/5"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = fallback;
      }}
    />
  );
}

function TeamLogo({
  slug,
  alt,
  size = 24,
  fallback = "/team-logos/_placeholder.png",
}: {
  slug?: string | null;
  alt: string;
  size?: number;
  fallback?: string;
}) {
  return (
    <img
      src={getTeamLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="object-contain shrink-0 rounded-sm bg-white/5"
      onError={(e) => {
        e.currentTarget.onerror = null; // evita loop infinito
        e.currentTarget.src = fallback;
      }}
    />
  );
}

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
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/10 text-white border border-white/15">
        FT
      </span>
    );
  }

  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/10 text-white/90 border border-white/15">
      PRE
    </span>
  );
}

function parseISODateParts(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return { y, m, d };
}

function parseTimeParts(t: string) {
  const parts = t.split(":").map((x) => parseInt(x, 10));
  const hh = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  const ss = parts[2] ?? 0;
  return { hh, mm, ss };
}

function formatDateShortTZ(iso: string, timeZone: string) {
  const { y, m, d } = parseISODateParts(iso);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(dt);
}

function formatKickoffInTZ(match_date: string, kickoff_time: string | null, timeZone: string) {
  if (!kickoff_time) return "TBD";
  const { y, m, d } = parseISODateParts(match_date);
  const { hh, mm, ss } = parseTimeParts(kickoff_time.length === 5 ? `${kickoff_time}:00` : kickoff_time);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh, mm, ss));
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(dt);
}

function parseRound(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatScore(status: MatchStatus, hs: number | null, as: number | null) {
  if (status === "NS") return "—";
  if (hs == null || as == null) return "-";
  return `${hs} - ${as}`;
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

async function fetchTeamsForSeason(seasonId: number) {
  const { data, error } = await supabase
    .from("matches")
    .select(`
      home_team:home_team_id ( id, name, slug ),
      away_team:away_team_id ( id, name, slug )
    `)
    .eq("season_id", seasonId);

  if (error) throw error;

  const map = new Map<number, { name: string; slug: string | null }>();

  for (const r of (data || []) as TeamRefRow[]) {
    const homeTeam = asTeamRef(r.home_team);
    const awayTeam = asTeamRef(r.away_team);

    if (homeTeam?.id) {
      map.set(homeTeam.id, {
        name: homeTeam.name,
        slug: homeTeam.slug ?? null,
      });
    }
    if (awayTeam?.id) {
      map.set(awayTeam.id, {
        name: awayTeam.name,
        slug: awayTeam.slug ?? null,
      });
    }
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
    .select(`
      status, home_score, away_score,
      home_team:home_team_id ( id, name, slug ),
      away_team:away_team_id ( id, name, slug )
    `)
    .eq("season_id", seasonId)
    .eq("status", "FT");

  if (error) throw error;

  const teamMap = await fetchTeamsForSeason(seasonId);
  const table = new Map<number, StandingRow>();

  for (const [id, team] of teamMap.entries()) {
    table.set(id, {
      teamId: id,
      team: team.name,
      teamSlug: team.slug,
      pj: 0,
      w: 0,
      d: 0,
      l: 0,
      pf: 0,
      pa: 0,
      pts: 0,
    });
  }

  let ftCount = 0;

  for (const r of (data || []) as StandingMatchRow[]) {
    const ht = asTeamRef(r.home_team);
    const at = asTeamRef(r.away_team);
    const hs = r.home_score;
    const as = r.away_score;

    if (!ht?.id || !at?.id) continue;
    if (typeof hs !== "number" || typeof as !== "number") continue;

    ftCount += 1;

    const home =
      table.get(ht.id) ?? {
        teamId: ht.id,
        team: ht.name,
        teamSlug: ht.slug ?? null,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
      };

    const away =
      table.get(at.id) ?? {
        teamId: at.id,
        team: at.name,
        teamSlug: at.slug ?? null,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
      };

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

    if (rules?.bottomRelegation && position > total - (rules.bottomRelegation ?? 0)) {
      badge = "relegation";
    }

    return { ...r, position, badge };
  });

  return { rows: withMeta, ftCount };
}

async function fetchStandingsZero(seasonId: number) {
  const teamMap = await fetchTeamsForSeason(seasonId);

  return Array.from(teamMap.entries())
    .map(([teamId, team]) => ({
      teamId,
      team: team.name,
      teamSlug: team.slug,
      pj: 0,
      w: 0,
      d: 0,
      l: 0,
      pf: 0,
      pa: 0,
      pts: 0,
    }))
    .sort((a, b) => a.team.localeCompare(b.team));
}

export default function LeagueClient() {
  const { timeZone, lang, setLangEverywhere } = usePrefs();

  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const refISO = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : toISODateLocal(new Date());
  const dateQuery = `?date=${refISO}`;

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const [comp, setComp] = useState<Competition | null>(null);
  const [season, setSeason] = useState<Season | null>(null);

  const [roundMeta, setRoundMeta] = useState<RoundMeta2[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const [matches, setMatches] = useState<DbMatchRow[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);

  const [loadingLeague, setLoadingLeague] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [err, setErr] = useState("");

  const [leaguesOpen, setLeaguesOpen] = useState(false);

  const t = (key: string) => I18N[lang][key] ?? key;

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
      .select(`
        id, match_date, kickoff_time, status, minute, home_score, away_score, round, venue,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug )
      `)
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

    for (const row of (data || []) as RoundQueryRow[]) {
      const r = parseRound(row.round);
      if (r == null) continue;

      const d = row.match_date as string;
      const st = (row.status as MatchStatus) ?? "NS";

      const cur = map.get(r);
      if (!cur) {
        map.set(r, { first: d, last: d, count: 1, ft: st === "FT" ? 1 : 0 });
      } else {
        if (d < cur.first) cur.first = d;
        if (d > cur.last) cur.last = d;
        cur.count += 1;
        if (st === "FT") cur.ft += 1;
      }
    }

    return Array.from(map.entries())
      .map(([round, v]) => ({
        round,
        first_date: v.first,
        last_date: v.last,
        matches: v.count,
        ft: v.ft,
      }))
      .sort((a, b) => a.round - b.round);
  }

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
        setErr("Slug is undefined.");
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
        setSelectedRound(meta.length > 0 ? pickAutoRound(meta, refISO) : null);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Error loading rounds");
        setLoadingLeague(false);
        return;
      }

      try {
        const computed = await fetchStandingsComputed(seasonData.id, compData.slug);
        if (computed.ftCount > 0) {
          setStandings(computed.rows);
        } else {
          setStandings(await fetchStandingsZero(seasonData.id));
        }
      } catch {
        setStandings(await fetchStandingsZero(seasonData.id));
      }

      setLoadingLeague(false);
    };

    loadLeagueEverything();
  }, [slug, refISO]);

  useEffect(() => {
    if (!season || selectedRound == null) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const m = await fetchMatchesForRound(season.id, selectedRound);
        if (cancelled) return;

        setMatches(m);
        setErr("");

        const hasLive = m.some((x) => x.status === "LIVE");
        timer = setTimeout(load, hasLive ? 10_000 : 60_000);
      } catch (e: unknown) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Error loading matches");
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
  }, [season, selectedRound]);

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
  const selectedIdx = useMemo(
    () => (selectedRound == null ? -1 : roundsList.indexOf(selectedRound)),
    [roundsList, selectedRound]
  );

  const timeLabelFor = (m: DbMatchRow) => {
    if (m.status === "LIVE") return `LIVE ${m.minute ?? ""}${m.minute ? "'" : ""}`.trim();
    if (m.status === "FT") return "FT";
    return formatKickoffInTZ(m.match_date, m.kickoff_time, timeZone);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0E4F33] text-white">
      <div className="pointer-events-none absolute inset-0">
  <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
  <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-green-300/10 blur-3xl" />
</div>

      <div className="relative">
        <AppHeader
          subtitle="League view"
          lang={lang}
          onLangChange={(l) => setLangEverywhere(l)}
        />

        <main className="mx-auto max-w-[1280px] px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <aside className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-4 h-fit text-white space-y-4">
            <div>
              <div className="text-sm font-semibold text-white/80">{t("league")}</div>
              <div className="mt-2 flex items-center gap-3 min-w-0">
                <LeagueLogo slug={comp?.slug} alt={comp?.name ?? "League"} size={26} />
                <div className="text-lg font-extrabold truncate">{comp?.name ?? slug}</div>
              </div>
              <div className="text-xs text-white/70 mt-2">
                {t("season")}: <span className="font-semibold">{season?.name ?? "—"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold text-white/85">{t("round")}</div>
                <div className="text-xs text-white/70">
                  {selectedRound != null ? `#${selectedRound}` : "—"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedIdx > 0 && setSelectedRound(roundsList[selectedIdx - 1])}
                  disabled={selectedIdx <= 0}
                  className="px-2 py-1 rounded-lg text-xs border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white"
                >
                  ←
                </button>

                <div className="flex-1 overflow-x-auto">
                  <div className="flex gap-1 pb-1">
                    {roundsList.map((r) => {
                      const active = selectedRound === r;
                      return (
                        <button
                          key={r}
                          onClick={() => setSelectedRound(r)}
                          className={`h-8 w-8 shrink-0 rounded-full text-xs font-semibold border transition flex items-center justify-center tabular-nums ${
                            active
                              ? "bg-emerald-400 text-black border-emerald-300"
                              : "bg-white/10 border-white/15 hover:bg-white/15 text-white"
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() =>
                    selectedIdx >= 0 &&
                    selectedIdx < roundsList.length - 1 &&
                    setSelectedRound(roundsList[selectedIdx + 1])
                  }
                  disabled={selectedIdx < 0 || selectedIdx >= roundsList.length - 1}
                  className="px-2 py-1 rounded-lg text-xs font-extrabold border border-emerald-300 bg-emerald-400 text-black hover:bg-emerald-300 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold text-white/85">{t("leagues")}</div>

                <button
                  onClick={() => setLeaguesOpen(true)}
                  className="lg:hidden px-3 py-1.5 rounded-xl text-xs font-extrabold border border-white/15 bg-white/10 hover:bg-white/15 text-white"
                >
                  {t("openLeaguesBtn")}
                </button>
              </div>

              <div className="hidden lg:block space-y-3">
                {groupedCompetitions.map(([groupName, comps]) => {
                  const open = openGroups[groupName] ?? (groupName === (comp?.group_name?.trim() || ""));
                  const featuredCount = comps.filter((x) => x.is_featured).length;

                  return (
                    <div key={groupName} className="rounded-xl border border-white/15 bg-white/10 overflow-hidden">
                      <button
                        onClick={() => setOpenGroups((p) => ({ ...p, [groupName]: !open }))}
                        className="w-full px-3 py-2 flex items-center justify-between text-left"
                        aria-label={`Toggle group ${groupName}`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold truncate text-white">{groupName}</div>
                          <div className="text-[11px] text-white/70">
                            {comps.length} leagues{featuredCount ? ` • ${featuredCount} featured` : ""}
                          </div>
                        </div>
                        <span className="text-xs text-white/70">{open ? "−" : "+"}</span>
                      </button>

                      {open ? (
                        <div className="px-2 pb-2 space-y-2">
                          {comps.map((c) => (
                            <Link
                              key={`${c.slug}-${c.id}`}
                              href={`/leagues/${c.slug}${dateQuery}`}
                              className={`block w-full px-3 py-2 rounded-xl border transition ${
                                c.slug === slug
                                  ? "bg-emerald-400/25 text-white border-emerald-200/30"
                                  : "bg-black/20 border-white/15 hover:bg-black/30 text-white"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <LeagueLogo slug={c.slug} alt={c.name} size={20} />
                                  <div className="text-sm font-medium truncate">{c.name}</div>
                                </div>

                                {c.is_featured ? (
                                  <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-300/25 text-white border border-emerald-200/30">
                                    PIN
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs opacity-80 mt-1">{c.region ?? ""}</div>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {leaguesOpen ? (
                <div className="lg:hidden fixed inset-0 z-50">
                  <button
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setLeaguesOpen(false)}
                    aria-label="Close leagues overlay"
                  />

                  <div className="absolute left-0 right-0 bottom-0 max-h-[85vh] rounded-t-2xl border border-white/10 bg-[#071a12] shadow-2xl overflow-hidden text-white">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <div className="font-extrabold">{t("leagues")}</div>
                      <button
                        onClick={() => setLeaguesOpen(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-white/15 bg-white/10 hover:bg-white/15"
                      >
                        {t("close")}
                      </button>
                    </div>

                    <div className="p-3 overflow-y-auto max-h-[calc(85vh-56px)] space-y-3">
                      {groupedCompetitions.map(([groupName, comps]) => {
                        const open = openGroups[groupName] ?? (groupName === (comp?.group_name?.trim() || ""));
                        const featuredCount = comps.filter((x) => x.is_featured).length;

                        return (
                          <div key={groupName} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <button
                              onClick={() => setOpenGroups((p) => ({ ...p, [groupName]: !open }))}
                              className="w-full px-3 py-2 flex items-center justify-between text-left"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold truncate">{groupName}</div>
                                <div className="text-[11px] text-white/70">
                                  {comps.length} leagues{featuredCount ? ` • ${featuredCount} featured` : ""}
                                </div>
                              </div>
                              <span className="text-xs text-white/70">{open ? "−" : "+"}</span>
                            </button>

                            {open ? (
                              <div className="px-2 pb-2 space-y-2">
                                {comps.map((c) => (
                                  <Link
                                    key={`${c.slug}-${c.id}`}
                                    href={`/leagues/${c.slug}${dateQuery}`}
                                    onClick={() => setLeaguesOpen(false)}
                                    className={`block w-full px-3 py-2 rounded-xl border transition ${
                                      c.slug === slug
                                        ? "bg-emerald-400/25 text-white border-emerald-200/30"
                                        : "bg-white/10 border-white/15 hover:bg-white/15 text-white"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <LeagueLogo slug={c.slug} alt={c.name} size={20} />
                                        <div className="text-sm font-medium truncate">{c.name}</div>
                                      </div>

                                      {c.is_featured ? (
                                        <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-300/25 text-white border border-emerald-200/30">
                                          PIN
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="text-xs opacity-80 mt-1">{c.region ?? ""}</div>
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="space-y-4 min-w-0 text-white">
            <div>
              <h2 className="text-xl font-bold">{t("matches")}</h2>
              <p className="text-sm text-white/80">
                {t("season")}: <span className="font-semibold">{season?.name ?? "—"}</span> • {t("round")}:{" "}
                <span className="font-semibold">{selectedRound ?? "—"}</span> • {t("tz")}:{" "}
                <span className="font-semibold">{timeZone}</span>
              </p>
            </div>

            {loadingLeague ? (
              <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-8 text-center text-white/85">
                {t("loadingLeague")}
              </div>
            ) : err ? (
              <div className="rounded-2xl border border-red-400/40 bg-red-500/10 backdrop-blur p-6 text-white">
                <div className="font-bold">{t("error")}</div>
                <div className="mt-2 text-sm opacity-90">{err}</div>
              </div>
            ) : roundMeta.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-8 text-center text-white/85">
                {t("noMatchesSeason")}
              </div>
            ) : loadingMatches ? (
              <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-8 text-center text-white/85">
                {t("loadingMatches")}
              </div>
            ) : matches.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-8 text-center text-white/85">
                {t("noMatchesRound")}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/15">
                  <div className="flex items-center gap-2 min-w-0">
                    <LeagueLogo slug={comp?.slug} alt={comp?.name ?? "League"} size={22} />
                    <div className="font-semibold truncate">{comp?.name ?? "League"}</div>
                  </div>
                  <div className="text-sm text-white/70 truncate">{comp?.region ?? ""}</div>
                </div>

                <div className="divide-y divide-white/10">
                  {matches.map((m) => {
                    const label = timeLabelFor(m);
                    const liveRow = m.status === "LIVE" ? "ring-1 ring-red-400/40 bg-red-500/10" : "";

                    return (
                      <div
                        key={m.id}
                        className={`px-4 py-3 flex items-center gap-4 transition hover:bg-white/5 ${liveRow}`}
                      >
                        <div className="w-32 shrink-0">
                          <div className="text-lg font-extrabold tracking-tight">{label}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge status={m.status} />
                            <span className="text-xs text-white/70">
                              {formatDateShortTZ(m.match_date, timeZone)}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                          <div className="flex items-center justify-between rounded-xl bg-white/10 border border-white/15 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamLogo slug={m.home_team?.slug} alt={m.home_team?.name ?? "Home"} size={22} />
                              <span className="font-medium truncate">{m.home_team?.name ?? "TBD"}</span>
                            </div>
                            <span className="font-extrabold tabular-nums">
                              {m.status === "NS" ? "—" : m.home_score ?? "-"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-xl bg-white/10 border border-white/15 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamLogo slug={m.away_team?.slug} alt={m.away_team?.name ?? "Away"} size={22} />
                              <span className="font-medium truncate">{m.away_team?.name ?? "TBD"}</span>
                            </div>
                            <span className="font-extrabold tabular-nums">
                              {m.status === "NS" ? "—" : m.away_score ?? "-"}
                            </span>
                          </div>
                        </div>

                        <div className="hidden md:block w-48 text-right text-xs text-white/70 shrink-0">
                          {m.venue ? <div className="truncate">{m.venue}</div> : null}
                          <div className="mt-1 font-extrabold tabular-nums text-white">
                            {formatScore(m.status, m.home_score, m.away_score)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 py-3 border-t border-white/15 flex justify-end">
                  <Link
                    href={`/leagues/${slug}${dateQuery}`}
                    className="text-xs font-extrabold px-3 py-2 rounded-full bg-emerald-300/25 text-white border border-emerald-200/30 hover:bg-emerald-300/35 transition"
                  >
                    {t("openLeague")}
                  </Link>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/15 bg-black/20 p-4 sm:p-6 backdrop-blur min-w-0">
              <div className="flex items-baseline justify-between gap-3 mb-4 min-w-0">
                <div className="font-bold text-base">{t("standings")}</div>
                <div className="text-xs text-white/70 truncate">
                  {t("season")}: {season?.name ?? "—"}
                </div>
              </div>

              {standings.length === 0 ? (
                <div className="text-sm text-white/80 mt-4">{t("comingSoon")}</div>
              ) : (
                <>
                  <div className="mb-3 text-[11px] text-white/70">{t("computedFromFT")}</div>

                  <div className="mt-2 overflow-x-auto rounded-xl border border-white/15 bg-white/5">
                    <table className="w-full text-xs table-auto">
                      <thead className="text-xs text-white/70 border-b border-white/10">
                        <tr>
                          <th className="text-left py-2 pl-2 pr-2 w-[1px]">#</th>
                          <th className="text-left py-2 w-[220px] sm:w-[320px]">Team</th>
                          <th className="text-right py-2 w-[30px]">PJ</th>
                          <th className="text-right py-2 w-[30px]">W</th>
                          <th className="text-right py-2 w-[30px]">D</th>
                          <th className="text-right py-2 w-[30px]">L</th>
                          <th className="hidden sm:table-cell text-right py-2 w-[30px]">PF</th>
                          <th className="hidden sm:table-cell text-right py-2 w-[30px]">PA</th>
                          <th className="text-right py-2 pr-2 w-[56px]">PTS</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/10">
                        {standings.map((r, idx) => {
                          const pos = r.position ?? idx + 1;
                          return (
                            <tr key={r.teamId} className="hover:bg-white/5 transition">
                              <td className="py-2 pl-2 pr-2 text-xs text-white/70 tabular-nums">{pos}</td>

                              <td className="py-2 font-medium w-[220px] sm:w-[320px] max-w-[320px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <TeamLogo slug={r.teamSlug} alt={r.team} size={22} />
                                  <span className="truncate">{r.team}</span>
                                </div>
                              </td>

                              <td className="py-2 text-right tabular-nums">{r.pj}</td>
                              <td className="py-2 text-right tabular-nums">{r.w}</td>
                              <td className="py-2 text-right tabular-nums">{r.d}</td>
                              <td className="py-2 text-right tabular-nums">{r.l}</td>
                              <td className="hidden sm:table-cell py-2 text-right tabular-nums">{r.pf}</td>
                              <td className="hidden sm:table-cell py-2 text-right tabular-nums">{r.pa}</td>
                              <td className="py-2 pr-2 text-right font-extrabold tabular-nums">{r.pts}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </main>

        <footer className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 text-xs text-white/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              RugbyNow • TZ: <span className="font-semibold break-all">{timeZone}</span>
            </div>
            <div className="opacity-90">
              <a className="underline" href="mailto:lopresttivito@gmail.com">
                lopresttivito@gmail.com
              </a>
              <span className="mx-2">•</span>
              <a
                className="underline"
                href="https://www.linkedin.com/in/vitoloprestti/"
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
