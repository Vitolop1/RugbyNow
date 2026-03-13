"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import AdSlot from "@/app/components/AdSlot";
import BrandWordmark from "@/app/components/BrandWordmark";
import BroadcastPill from "@/app/components/BroadcastPill";
import CompetitionSectionBadge from "@/app/components/CompetitionSectionBadge";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
import { getBroadcastsForCompetition } from "@/lib/broadcasts";
import {
  buildCompetitionNavigationSections,
  readSlugList,
  toggleSlug,
  writeSlugList,
} from "@/lib/competitionPrefs";
import { t } from "@/lib/i18n";
import { getMatchClockLabel, getMatchContextLabel } from "@/lib/matchPresentation";
import { usePrefs } from "@/lib/usePrefs";

type MatchStatus = "NS" | "LIVE" | "FT";

type Match = {
  matchDate: string;
  kickoffTime: string | null;
  home: string;
  away: string;
  homeSlug?: string | null;
  awaySlug?: string | null;
  minute: number | null;
  hs: number | null;
  as: number | null;
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
  country_code?: string | null;
  category?: string | null;
  group_name?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
};

type DbMatchRow = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: number; name: string; slug: string } | null;
  away_team: { id: number; name: string; slug: string } | null;
  season:
    | {
        competition: {
          name: string;
          slug: string;
          region: string | null;
        } | null;
      }
    | null;
};

function TeamLogo({ slug, alt, size = 22 }: { slug?: string | null; alt: string; size?: number }) {
  return (
    <img
      src={getTeamLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-sm bg-white/5 object-contain"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/team-logos/_placeholder.png";
      }}
    />
  );
}

function LeagueLogo({ slug, alt, size = 20 }: { slug?: string | null; alt: string; size?: number }) {
  return (
    <img
      src={getLeagueLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 rounded-sm bg-white/5 object-contain"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/league-logos/_placeholder.png";
      }}
    />
  );
}

function StatusBadge({ status, lang }: { status: MatchStatus; lang: "en" | "es" | "fr" | "it" }) {
  const tr = (key: string) => t(lang, key);
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        {tr("statusLive")}
      </span>
    );
  }

  if (status === "FT") {
    return (
      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white">
        {tr("statusFt")}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white/90">
      {tr("statusPre")}
    </span>
  );
}

function TeamName({ name, slug }: { name: string; slug?: string | null }) {
  const content = (
    <>
      <TeamLogo slug={slug} alt={name} />
      <span className="truncate">{name}</span>
    </>
  );

  if (!slug) {
    return <span className="flex min-w-0 items-center gap-2">{content}</span>;
  }

  return (
    <Link href={`/teams/${slug}`} className="flex min-w-0 items-center gap-2 hover:text-emerald-200">
      {content}
    </Link>
  );
}

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
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

function niceDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: Date, b: Date) {
  return toISODateLocal(a) === toISODateLocal(b);
}

function dedupeBlock(block: LeagueBlock) {
  const seen = new Set<string>();
  const matches: Match[] = [];

  for (const match of block.matches) {
    const pair = [match.home, match.away].map((value) => value.trim().toLowerCase()).sort().join("|");
    const scores =
      match.hs == null && match.as == null
        ? ""
        : [match.hs ?? "", match.as ?? ""].map(String).sort().join("|");
    const key = `${block.slug}|${match.matchDate}|${match.kickoffTime ?? ""}|${pair}|${match.status}|${scores}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(match);
  }

  return { ...block, matches };
}

function getInitialSelectedISO() {
  if (typeof window === "undefined") return toISODateLocal(new Date());
  const params = new URLSearchParams(window.location.search);
  const date = params.get("date");
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toISODateLocal(new Date());
}

export default function HomeClient() {
  const router = useRouter();
  const { timeZone, mounted, lang, theme } = usePrefs();
  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");
  const [selectedISO, setSelectedISO] = useState<string>(getInitialSelectedISO);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError] = useState("");
  const [blocks, setBlocks] = useState<LeagueBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [hiddenSlugs, setHiddenSlugs] = useState<string[]>([]);
  const [, setClockTick] = useState(0);
  const homeBannerSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_BANNER;
  const homeRailSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_RAIL;

  const lastPushedISO = useRef<string>("");
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const selectedDate = useMemo(() => fromISODateLocal(selectedISO), [selectedISO]);
  const todayLocal = new Date();
  const dateQuery = `?date=${selectedISO}`;
  const tr = (key: string) => t(lang, key);
  const otherGroupLabel = tr("groupsOther");
  const featuredGroupLabel = tr("groupsFeatured");
  const franchisesGroupLabel = tr("groupsFranchises");
  const selectionsGroupLabel = tr("groupsSelections");
  const argentinaGroupLabel = tr("groupsArgentina");
  const englandGroupLabel = tr("groupsEngland");
  const franceGroupLabel = tr("groupsFrance");
  const italyGroupLabel = tr("groupsItaly");
  const spainGroupLabel = tr("groupsSpain");
  const germanyGroupLabel = tr("groupsGermany");
  const portugalGroupLabel = tr("groupsPortugal");
  const brazilGroupLabel = tr("groupsBrazil");
  const uruguayGroupLabel = tr("groupsUruguay");
  const paraguayGroupLabel = tr("groupsParaguay");
  const colombiaGroupLabel = tr("groupsColombia");
  const chileGroupLabel = tr("groupsChile");
  const mexicoGroupLabel = tr("groupsMexico");
  const usaGroupLabel = tr("groupsUSA");
  const sevenGroupLabel = tr("groupsSeven");

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const id = window.requestAnimationFrame(() => {
      setSidebarOpen(window.localStorage.getItem("rn:home-sidebar-open") !== "0");
      setFavoriteSlugs(readSlugList("rn:favorite-leagues"));
      setHiddenSlugs(readSlugList("rn:hidden-leagues"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    window.localStorage.setItem("rn:home-sidebar-open", sidebarOpen ? "1" : "0");
  }, [mounted, sidebarOpen]);

  useEffect(() => {
    if (!mounted) return;
    writeSlugList("rn:favorite-leagues", favoriteSlugs);
  }, [favoriteSlugs, mounted]);

  useEffect(() => {
    if (!mounted) return;
    writeSlugList("rn:hidden-leagues", hiddenSlugs);
  }, [hiddenSlugs, mounted]);

  useEffect(() => {
    const id = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (lastPushedISO.current === selectedISO) return;
    lastPushedISO.current = selectedISO;
    router.replace(`/?date=${selectedISO}`, { scroll: false });
  }, [router, selectedISO]);

  useEffect(() => {
    const loadCompetitions = async () => {
      setCompLoading(true);
      setCompError("");

      const response = await fetch("/api/competitions", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        setCompetitions([]);
        setCompError(payload.error ?? tr("unknownCompetitionsError"));
      } else {
        setCompetitions((payload.competitions || []) as Competition[]);
      }

      setCompLoading(false);
    };

    loadCompetitions();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loadMatches = async () => {
      setLoading(true);
      setLoadError("");

      const response = await fetch(`/api/home?date=${selectedISO}`, { cache: "no-store" });
      const payload = await response.json();

      if (cancelled) return;

      if (!response.ok) {
        setBlocks([]);
        setLoadError(payload.error ?? tr("unknownMatchesError"));
        setLoading(false);
        timer = setTimeout(loadMatches, 60000);
        return;
      }

      const rows = (payload.matches || []) as DbMatchRow[];
      const byLeague = new Map<string, LeagueBlock>();
      let hasLive = false;

      for (const row of rows) {
        if (row.status === "LIVE") hasLive = true;

        const leagueName = row.season?.competition?.name ?? tr("unknownCompetition");
        const leagueSlug = row.season?.competition?.slug ?? "unknown";
        const region = row.season?.competition?.region ?? "";

        const match: Match = {
          matchDate: row.match_date,
          kickoffTime: row.kickoff_time,
          home: row.home_team?.name ?? tr("tbd"),
          away: row.away_team?.name ?? tr("tbd"),
          homeSlug: row.home_team?.slug ?? null,
          awaySlug: row.away_team?.slug ?? null,
          minute: row.minute,
          hs: row.status === "NS" ? null : row.home_score,
          as: row.status === "NS" ? null : row.away_score,
          status: row.status,
        };

        if (!byLeague.has(leagueSlug)) {
          byLeague.set(leagueSlug, { league: leagueName, region, slug: leagueSlug, matches: [] });
        }

        byLeague.get(leagueSlug)!.matches.push(match);
      }

      setBlocks(Array.from(byLeague.values()).map(dedupeBlock));
      setLoading(false);
      timer = setTimeout(loadMatches, hasLive ? 30000 : 180000);
    };

    loadMatches();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedISO, timeZone]);

  const dedupedCompetitions = useMemo(() => {
    const pickBetter = (a: Competition, b: Competition) => {
      if (!!a.is_featured !== !!b.is_featured) return a.is_featured ? a : b;
      const aSort = a.sort_order ?? 9999;
      const bSort = b.sort_order ?? 9999;
      if (aSort !== bSort) return aSort < bSort ? a : b;
      return a.id < b.id ? a : b;
    };

    const bySlug = new Map<string, Competition>();
    for (const competition of competitions) {
      const key = competition.slug.trim().toLowerCase();
      if (!key) continue;
      bySlug.set(key, bySlug.has(key) ? pickBetter(bySlug.get(key)!, competition) : competition);
    }

    return Array.from(bySlug.values());
  }, [competitions]);

  const navigationSections = useMemo(
    () =>
      buildCompetitionNavigationSections(
        dedupedCompetitions.filter((item) => !hiddenSlugs.includes(item.slug)),
        {
          featured: featuredGroupLabel,
          franchises: franchisesGroupLabel,
          selections: selectionsGroupLabel,
          seven: sevenGroupLabel,
          other: otherGroupLabel,
          argentina: argentinaGroupLabel,
          england: englandGroupLabel,
          france: franceGroupLabel,
          italy: italyGroupLabel,
          spain: spainGroupLabel,
          germany: germanyGroupLabel,
          portugal: portugalGroupLabel,
          brazil: brazilGroupLabel,
          uruguay: uruguayGroupLabel,
          paraguay: paraguayGroupLabel,
          colombia: colombiaGroupLabel,
          chile: chileGroupLabel,
          mexico: mexicoGroupLabel,
          usa: usaGroupLabel,
        }
      ),
    [
      argentinaGroupLabel,
      brazilGroupLabel,
      chileGroupLabel,
      colombiaGroupLabel,
      dedupedCompetitions,
      englandGroupLabel,
      featuredGroupLabel,
      franchisesGroupLabel,
      franceGroupLabel,
      germanyGroupLabel,
      hiddenSlugs,
      italyGroupLabel,
      mexicoGroupLabel,
      otherGroupLabel,
      paraguayGroupLabel,
      portugalGroupLabel,
      selectionsGroupLabel,
      sevenGroupLabel,
      spainGroupLabel,
      uruguayGroupLabel,
      usaGroupLabel,
    ]
  );

  const favoriteCompetitions = useMemo(
    () =>
      dedupedCompetitions
        .filter((competition) => favoriteSlugs.includes(competition.slug) && !hiddenSlugs.includes(competition.slug))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [dedupedCompetitions, favoriteSlugs, hiddenSlugs]
  );

  const hiddenCompetitions = useMemo(
    () => dedupedCompetitions.filter((competition) => hiddenSlugs.includes(competition.slug)).sort((a, b) => a.name.localeCompare(b.name)),
    [dedupedCompetitions, hiddenSlugs]
  );

  const filteredBlocks = useMemo(() => {
    const visibleBlocks = blocks.filter((block) => !hiddenSlugs.includes(block.slug));
    if (tab !== "LIVE") return visibleBlocks;
    return visibleBlocks
      .map((block) => ({ ...block, matches: block.matches.filter((match) => match.status === "LIVE") }))
      .filter((block) => block.matches.length > 0);
  }, [blocks, tab, hiddenSlugs]);
  const hasHomeEditorialContent = !loading && filteredBlocks.some((block) => block.matches.length > 0);

  const dateHeroLabel = isSameDay(selectedDate, todayLocal) ? tr("today").toUpperCase() : niceDate(selectedDate);

  const toggleFavoriteLeague = (slug: string) => setFavoriteSlugs((prev) => toggleSlug(prev, slug));
  const toggleHiddenLeague = (slug: string) => setHiddenSlugs((prev) => toggleSlug(prev, slug));

  return (
    <div className="rn-app-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-lime-200/10 blur-3xl" />
      </div>

      <div className="relative">
        <AppHeader showTabs tab={tab} setTab={setTab} />

        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="fixed left-4 top-[148px] z-40 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-black/25 text-white backdrop-blur transition hover:bg-black/35"
          aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
        >
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-6 rounded-full bg-white" />
            <span className="block h-0.5 w-6 rounded-full bg-white" />
            <span className="block h-0.5 w-6 rounded-full bg-white" />
          </span>
        </button>

        <main
          className={`w-full overflow-x-clip px-4 py-6 sm:px-6 xl:pr-[348px] ${
            sidebarOpen ? "xl:pl-[412px]" : "xl:pl-[92px]"
          }`}
        >
          <aside
            className={`fixed left-4 top-[212px] z-30 h-[calc(100vh-244px)] w-[calc(100vw-2rem)] max-w-[380px] space-y-4 overflow-x-hidden overflow-y-auto rounded-2xl border border-white/15 bg-[#0a4b31]/90 p-4 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              sidebarOpen ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[120%] opacity-0"
            } transition-all duration-300`}
          >
            <div>
              <div className="mb-2 text-sm font-semibold text-white/90">{tr("leagues")}</div>

              {compLoading ? (
                <div className="text-xs text-white/70">{tr("loadingLeagues")}</div>
              ) : compError ? (
                <div className="text-xs text-red-200">{compError}</div>
              ) : (
                <div className="space-y-3">
                  {navigationSections.map((section) => {
                    const open = openGroups[section.key] ?? false;
                    const pinnedCount = section.competitions.filter((competition) => competition.is_featured).length;

                    if (section.key === "featured") {
                      const highlightedCompetitions = favoriteCompetitions.length ? favoriteCompetitions : section.competitions;

                      if (!highlightedCompetitions.length) {
                        return null;
                      }

                      return (
                        <div key={section.key} className="rounded-xl border border-emerald-200/20 bg-emerald-300/10 p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-50/85">
                            <CompetitionSectionBadge badgeKey={section.badgeKey} alt={section.label} size={16} />
                            <span>{section.label}</span>
                          </div>
                          <div className="space-y-2">
                            {highlightedCompetitions.map((competition) => (
                              <div
                                key={`${section.key}-${competition.slug}-${competition.id}`}
                                className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2"
                              >
                                <Link href={`/leagues/${competition.slug}${dateQuery}`} className="flex min-w-0 flex-1 items-center gap-2">
                                  <LeagueLogo slug={competition.slug} alt={competition.name} />
                                  <span className="truncate text-sm font-medium text-white">{competition.name}</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => toggleFavoriteLeague(competition.slug)}
                                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                                    favoriteSlugs.includes(competition.slug)
                                      ? "border-amber-300/40 bg-amber-300/20 text-amber-300"
                                      : "border-white/15 bg-black/25 text-white/60 hover:bg-black/35"
                                  }`}
                                  title={favoriteSlugs.includes(competition.slug) ? tr("removeFavorite") : tr("addFavorite")}
                                  aria-label={favoriteSlugs.includes(competition.slug) ? tr("removeFavorite") : tr("addFavorite")}
                                >
                                  <span className="text-sm leading-none">{favoriteSlugs.includes(competition.slug) ? "\u2605" : "\u2606"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleHiddenLeague(competition.slug)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-sm text-white/80 transition hover:bg-black/35"
                                  title={tr("hideLeague")}
                                  aria-label={tr("hideLeague")}
                                >
                                  {"\u{1F441}"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={section.key} className="overflow-hidden rounded-xl border border-white/15 bg-white/10">
                        <button
                          onClick={() => setOpenGroups((prev) => ({ ...prev, [section.key]: !open }))}
                          className="flex w-full items-center justify-between px-3 py-2 text-left"
                          aria-label={`Toggle group ${section.label}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 truncate text-sm font-extrabold text-white">
                              <CompetitionSectionBadge badgeKey={section.badgeKey} alt={section.label} size={18} />
                              <span>{section.label}</span>
                            </div>
                            <div className="text-[11px] text-white/70">
                              {section.competitions.length} {tr("leagues").toLowerCase()}
                              {pinnedCount ? ` | ${pinnedCount} ${tr("featured")}` : ""}
                            </div>
                          </div>
                          <span className="text-xs text-white/70">{open ? "-" : "+"}</span>
                        </button>

                        {open ? (
                          <div className="space-y-2 px-2 pb-2">
                            {section.competitions.map((competition) => (
                              <div
                                key={`${section.key}-${competition.slug}-${competition.id}`}
                                className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2 transition hover:bg-black/30"
                              >
                                <Link href={`/leagues/${competition.slug}${dateQuery}`} className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <LeagueLogo slug={competition.slug} alt={competition.name} />
                                      <div className="truncate text-sm font-medium text-white">{competition.name}</div>
                                    </div>
                                    {competition.is_featured ? (
                                      <span className="rounded-full border border-emerald-200/30 bg-emerald-300/25 px-2 py-1 text-[10px] font-extrabold text-white">
                                        {tr("pinned")}
                                      </span>
                                    ) : null}
                                  </div>
                                  {competition.region ? <div className="mt-1 text-xs text-white/70">{competition.region}</div> : null}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => toggleFavoriteLeague(competition.slug)}
                                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
                                    favoriteSlugs.includes(competition.slug)
                                      ? "border-amber-300/40 bg-amber-300/20 text-amber-300"
                                      : "border-white/15 bg-black/25 text-white/60 hover:bg-black/35"
                                  }`}
                                  title={favoriteSlugs.includes(competition.slug) ? tr("removeFavorite") : tr("addFavorite")}
                                  aria-label={favoriteSlugs.includes(competition.slug) ? tr("removeFavorite") : tr("addFavorite")}
                                >
                                  <span className="text-sm leading-none">{favoriteSlugs.includes(competition.slug) ? "\u2605" : "\u2606"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleHiddenLeague(competition.slug)}
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-sm text-white/80 transition hover:bg-black/35"
                                  title={tr("hideLeague")}
                                  aria-label={tr("hideLeague")}
                                >
                                  {"\u{1F441}"}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {hiddenCompetitions.length ? (
                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                      <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/70">{tr("hiddenLeagues")}</div>
                      <div className="space-y-2">
                        {hiddenCompetitions.map((competition) => (
                          <div
                            key={`hidden-${competition.slug}`}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                          >
                            <LeagueLogo slug={competition.slug} alt={competition.name} />
                            <span className="min-w-0 flex-1 truncate text-sm text-white/80">{competition.name}</span>
                            <button
                              type="button"
                              onClick={() => toggleHiddenLeague(competition.slug)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-sm text-white transition hover:bg-black/35"
                              title={tr("showLeague")}
                              aria-label={tr("showLeague")}
                            >
                              {"\u{1F441}"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <div className="flex min-w-0 flex-col gap-6 xl:flex-row">
              <section className="min-w-0 flex-1 space-y-4">
                <div className="rounded-2xl border border-white/15 bg-black/20 p-4 backdrop-blur">
                  <div className="mb-4 text-sm font-semibold text-white/90">{tr("dates")}</div>

                  <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] gap-3 lg:grid-cols-[150px_minmax(0,1fr)_150px]">
                    <button
                      onClick={() => setSelectedISO(toISODateLocal(addDays(selectedDate, -1)))}
                      className="flex min-h-[72px] items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-2 py-3 transition hover:bg-white/15 lg:gap-3 lg:px-4"
                    >
                      <span className="text-3xl font-black text-white">&lt;</span>
                      <span className="hidden flex-col text-left lg:flex">
                        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">{tr("goTo")}</span>
                        <span className="text-lg font-extrabold text-white">{tr("yesterday")}</span>
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        if (typeof datePickerRef.current?.showPicker === "function") {
                          datePickerRef.current.showPicker();
                          return;
                        }
                        datePickerRef.current?.focus();
                        datePickerRef.current?.click();
                      }}
                      className={`flex min-h-[72px] min-w-0 flex-col items-center justify-center rounded-2xl border px-3 py-3 transition lg:px-4 ${
                        isSameDay(selectedDate, todayLocal)
                          ? "border-emerald-300/35 bg-emerald-400/20 text-white"
                          : "border-white/15 bg-white/10 text-white hover:bg-white/15"
                      }`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/55">
                        {isSameDay(selectedDate, todayLocal) ? tr("weAreOn") : tr("standingOn")}
                      </span>
                      <span className="mt-1 line-clamp-2 text-center text-xl font-black leading-tight sm:text-2xl lg:text-3xl">
                        {dateHeroLabel}
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedISO(toISODateLocal(addDays(selectedDate, 1)))}
                      className="flex min-h-[72px] items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/25 px-2 py-3 transition hover:bg-emerald-400/35 lg:gap-3 lg:px-4"
                    >
                      <span className="hidden flex-col text-right lg:flex">
                        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/60">{tr("goTo")}</span>
                        <span className="text-lg font-extrabold text-white">{tr("tomorrow")}</span>
                      </span>
                      <span className="text-3xl font-black text-white">&gt;</span>
                    </button>
                  </div>

                  <input
                    ref={datePickerRef}
                    type="date"
                    value={selectedISO}
                    onChange={(e) => setSelectedISO(e.target.value)}
                    className="fixed left-0 top-0 h-px w-px opacity-0"
                    tabIndex={-1}
                  />

                  {!isSameDay(selectedDate, todayLocal) ? (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => setSelectedISO(toISODateLocal(new Date()))}
                        className="rounded-full border border-emerald-300/30 bg-emerald-400/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-400/30"
                      >
                        {tr("backToToday")}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white">{tr("matches")}</h2>
                  <p className="text-sm text-white/80">
                    {tr("selectedAt")}: <span className="font-semibold text-white">{niceDate(selectedDate)}</span>  | {" "}
                    {tab === "LIVE" ? tr("liveOnly") : tr("allMatches")}  |  {tr("tz")}:{" "}
                    <span className="font-semibold text-white">{timeZone}</span>
                  </p>
                </div>

                {loading ? (
                  <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-center text-white/80 backdrop-blur">
                    {tr("loadingMatches")}
                  </div>
                ) : loadError ? (
                  <div className="rounded-2xl border border-red-200/30 bg-black/20 p-6 text-white backdrop-blur">
                    <div className="font-bold">{tr("loadError")}</div>
                    <div className="mt-2 text-sm text-white/80">{loadError}</div>
                  </div>
                ) : filteredBlocks.length === 0 ? (
                  <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-center text-white/80 backdrop-blur">
                    {tr("noMatchesForDate")}
                  </div>
                ) : (
                  filteredBlocks.map((block) => (
                    <div key={block.slug} className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur">
                      <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <LeagueLogo slug={block.slug} alt={block.league} />
                          <div className="truncate font-semibold text-white">{block.league}</div>
                        </div>
                        <div className="text-sm text-white/70">{block.region}</div>
                      </div>

                      <div className="divide-y divide-white/10">
                        {block.matches.map((match, index) => {
                          const clockLabel = getMatchClockLabel({
                            status: match.status,
                            minute: match.minute,
                            matchDate: match.matchDate,
                            kickoffTime: match.kickoffTime,
                            timeZone,
                            lang,
                          });
                          const contextLabel = getMatchContextLabel({
                            status: match.status,
                            minute: match.minute,
                            matchDate: match.matchDate,
                            kickoffTime: match.kickoffTime,
                            timeZone,
                            lang,
                          });
                          const broadcasts = getBroadcastsForCompetition(block.slug);

                          return (
                            <div
                              key={`${block.slug}-${index}-${match.matchDate}-${match.kickoffTime ?? ""}-${match.home}-${match.away}`}
                              className={`flex flex-col gap-3 px-4 py-3 transition ${
                                match.status === "LIVE" ? "bg-red-400/10 ring-1 ring-red-300/40" : "hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-start gap-4">
                            <div className="w-32 shrink-0">
                              <div className="text-lg font-extrabold tracking-tight text-white">{clockLabel}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <StatusBadge status={match.status} lang={lang} />
                                <span className="text-[11px] font-semibold text-white/70">{contextLabel}</span>
                              </div>
                            </div>

                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                                <TeamName name={match.home} slug={match.homeSlug} />
                                <span className="font-extrabold tabular-nums text-white">{match.status === "NS" ? "-" : match.hs ?? "-"}</span>
                              </div>
                              <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                                <TeamName name={match.away} slug={match.awaySlug} />
                                <span className="font-extrabold tabular-nums text-white">{match.status === "NS" ? "-" : match.as ?? "-"}</span>
                              </div>
                            </div>

                            <div className="hidden w-36 shrink-0 text-right text-xs text-white/70 md:block">
                              {match.status === "LIVE"
                                ? tr("liveAction")
                                : match.status === "FT"
                                  ? tr("final")
                                  : tr("upcoming")}
                            </div>
                              </div>
                          {broadcasts.length ? (
                            <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-32">
                              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                                {tr("watchOn")}
                              </span>
                              {broadcasts.map((provider) => (
                                <BroadcastPill key={`${block.slug}-${provider.id}`} provider={provider} compact />
                              ))}
                            </div>
                          ) : null}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end border-t border-white/15 px-4 py-3">
                        <Link
                          href={`/leagues/${block.slug}${dateQuery}`}
                          className="rounded-full border border-emerald-200/30 bg-emerald-300/25 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-300/35"
                        >
                          {tr("openLeague")}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>

            {hasHomeEditorialContent ? (
              <AdSlot
                slot={homeBannerSlot}
                format="horizontal"
                minHeight={140}
                fallbackTitle="Banner premium RugbyNow"
                fallbackSubtitle="Espacio horizontal para anuncios debajo de los partidos."
                className="hidden min-h-[140px] w-full lg:block"
              />
            ) : null}
          </div>
        </main>

        {hasHomeEditorialContent ? (
          <div className="pointer-events-none fixed bottom-0 right-4 top-[212px] z-20 hidden w-[320px] py-4 xl:block">
            <AdSlot
              slot={homeRailSlot}
              format="vertical"
              minHeight={600}
              fallbackTitle="Tu marca puede vivir aca"
              fallbackSubtitle="Espacio vertical para sponsors, promos o publicidad propia de RugbyNow."
              className="h-full"
            />
          </div>
        ) : null}

        <footer className={`w-full px-4 py-8 text-xs text-white/70 sm:px-6 xl:pr-[348px] ${sidebarOpen ? "xl:pl-[412px]" : "xl:pl-[92px]"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <BrandWordmark
                key={`home-footer-brand-${theme}`}
                theme={theme}
                width={150}
                height={28}
                className="h-auto w-[120px] object-contain sm:w-[150px]"
                fallbackClassName="text-base font-extrabold rn-text-primary"
              />
              <div>
                {tr("builtBy")} <span className="font-semibold text-white">Vito Loprestti</span>  |  TZ:{" "}
                <span className="font-semibold text-white">{timeZone}</span>
              </div>
            </div>
            <div className="opacity-90">
              {tr("contact")}:{" "}
              <a className="underline" href="mailto:lopresttivito@gmail.com">
                lopresttivito@gmail.com
              </a>
              <span className="mx-2"> | </span>
              <a className="underline" href="https://www.linkedin.com/in/vitoloprestti/" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

