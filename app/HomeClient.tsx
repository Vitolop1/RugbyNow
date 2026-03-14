"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import AdSlot from "@/app/components/AdSlot";
import BrandWordmark from "@/app/components/BrandWordmark";
import BroadcastPill from "@/app/components/BroadcastPill";
import CompetitionSectionBadge from "@/app/components/CompetitionSectionBadge";
import SuggestedWatchButton from "@/app/components/SuggestedWatchButton";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
import { getBroadcastsForCompetition } from "@/lib/broadcasts";
import { getCompetitionNoticeKey } from "@/lib/competitionMessaging";
import { getDateLocale } from "@/lib/dateLocale";
import {
  applyNavigationSectionOrder,
  buildCompetitionNavigationSections,
  getCompetitionSortPriority,
  moveSlug,
  readOrderedKeys,
  reorderNavigationSectionKeys,
  readSlugList,
  toggleSlug,
  writeOrderedKeys,
  writeSlugList,
} from "@/lib/competitionPrefs";
import { t } from "@/lib/i18n";
import { isActiveMatchStatus, isResultPendingMatch, isScheduledMatchStatus, type MatchStatus } from "@/lib/matchStatus";
import { getMatchClockLabel, getMatchContextLabel } from "@/lib/matchPresentation";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";
import { usePrefs } from "@/lib/usePrefs";

type Match = {
  matchDate: string;
  kickoffTime: string | null;
  home: string;
  away: string;
  homeSlug?: string | null;
  awaySlug?: string | null;
  minute: number | null;
  updatedAt?: string | null;
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
  updated_at?: string | null;
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

function StatusBadge({
  status,
  lang,
  resultPending = false,
}: {
  status: MatchStatus;
  lang: "en" | "es" | "fr" | "it";
  resultPending?: boolean;
}) {
  const tr = (key: string) => t(lang, key);
  if (resultPending) {
    return (
      <span className="rounded-full border border-amber-300/30 bg-amber-300/15 px-2 py-1 text-xs font-semibold text-amber-50">
        {tr("statusPending")}
      </span>
    );
  }

  if (isActiveMatchStatus(status)) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        {status === "HT" ? tr("statusHt") : tr("statusLive")}
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

  if (status === "CANC") {
    return (
      <span className="rounded-full border border-white/15 bg-slate-400/15 px-2 py-1 text-xs font-semibold text-white/90">
        {tr("statusCanc")}
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

function niceDate(d: Date, lang: "en" | "es" | "fr" | "it") {
  return d.toLocaleDateString(getDateLocale(lang), {
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
  const logicalMatches = new Map<string, Match>();

  const qualityFor = (match: Match) => {
    let score = 0;
    if (match.kickoffTime && match.kickoffTime !== "00:00:00" && match.kickoffTime !== "00:00") score += 40;
    if (match.hs != null && match.as != null) score += 20;
    if (match.status === "FT") score += 15;
    else if (isActiveMatchStatus(match.status)) score += 10;
    else if (match.status === "CANC") score += 6;
    else if (match.status === "NS") score += 5;
    return score;
  };

  for (const match of block.matches) {
    const pair = [match.home, match.away].map((value) => value.trim().toLowerCase()).join("|");
    const key = `${block.slug}|${match.matchDate}|${pair}`;
    const current = logicalMatches.get(key);
    if (!current || qualityFor(match) >= qualityFor(current)) {
      logicalMatches.set(key, match);
    }
  }

  return {
    ...block,
    matches: Array.from(logicalMatches.values()).sort(
      (a, b) => String(a.kickoffTime || "").localeCompare(String(b.kickoffTime || "")) || a.home.localeCompare(b.home)
    ),
  };
}

const HOME_SIDEBAR_KEY = "rn:home-sidebar-open";
const HOME_LAST_ENTRY_DAY_KEY = "rn:home-last-entry-day";
const SIDEBAR_SECTION_ORDER_KEY = "rn:league-section-order";
const DEFAULT_SECTION_ORDER = [
  "featured",
  "country:france",
  "country:italy",
  "country:europe",
  "country:england",
  "selections",
  "franchises",
  "country:southamerica",
  "seven",
  "country:usa",
  "country:argentina",
  "other",
];

function getInitialHomeSidebarOpen() {
  return false;
}

function readSidebarPreference(storageKey: string) {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(storageKey);
  if (saved === "true") return true;
  if (saved === "false") return false;
  return null;
}

export default function HomeClient({ initialDate }: { initialDate?: string }) {
  const router = useRouter();
  const { timeZone, mounted, lang, theme } = usePrefs();
  const hasExplicitInitialDate = Boolean(initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate));
  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");
  const [selectedISO, setSelectedISO] = useState<string>(() =>
    hasExplicitInitialDate ? (initialDate as string) : getISODateInTimeZone(new Date(), "America/New_York")
  );
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError] = useState("");
  const [blocks, setBlocks] = useState<LeagueBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(getInitialHomeSidebarOpen);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [hiddenSlugs, setHiddenSlugs] = useState<string[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [, setClockTick] = useState(0);
  const homeBannerSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_BANNER;
  const homeRailSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_RAIL;

  const lastPushedISO = useRef<string>("");
  const previousTodayISORef = useRef<string>(getISODateInTimeZone(new Date(), "America/New_York"));
  const draggedSectionKeyRef = useRef<string | null>(null);
  const datePickerRef = useRef<HTMLInputElement | null>(null);
  const selectedDate = useMemo(() => fromISODateLocal(selectedISO), [selectedISO]);
  const todayISO = useMemo(
    () => getISODateInTimeZone(new Date(), mounted ? timeZone : "America/New_York"),
    [mounted, timeZone]
  );
  const todayLocal = useMemo(() => fromISODateLocal(todayISO), [todayISO]);
  const previousDate = useMemo(() => addDays(selectedDate, -1), [selectedDate]);
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
  const europeGroupLabel = tr("groupsEurope");
  const spainGroupLabel = tr("groupsSpain");
  const germanyGroupLabel = tr("groupsGermany");
  const portugalGroupLabel = tr("groupsPortugal");
  const brazilGroupLabel = tr("groupsBrazil");
  const uruguayGroupLabel = tr("groupsUruguay");
  const paraguayGroupLabel = tr("groupsParaguay");
  const colombiaGroupLabel = tr("groupsColombia");
  const chileGroupLabel = tr("groupsChile");
  const southAmericaGroupLabel = tr("groupsSouthAmerica");
  const mexicoGroupLabel = tr("groupsMexico");
  const usaGroupLabel = tr("groupsUSA");
  const sevenGroupLabel = tr("groupsSeven");

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const desktopSidebar = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = () => {
      const saved = readSidebarPreference(HOME_SIDEBAR_KEY);
      setSidebarOpen(desktopSidebar.matches ? (saved ?? true) : false);
    };
    const id = window.requestAnimationFrame(() => {
      syncSidebar();
      setFavoriteSlugs(readSlugList("rn:favorite-leagues"));
      setHiddenSlugs(readSlugList("rn:hidden-leagues"));
      setSectionOrder(readOrderedKeys(SIDEBAR_SECTION_ORDER_KEY));
      setPrefsLoaded(true);
    });
    desktopSidebar.addEventListener("change", syncSidebar);
    return () => {
      window.cancelAnimationFrame(id);
      desktopSidebar.removeEventListener("change", syncSidebar);
    };
  }, [mounted]);

  const toggleSidebarOpen = () =>
    setSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
        window.localStorage.setItem(HOME_SIDEBAR_KEY, String(next));
      }
      return next;
    });

  useEffect(() => {
    if (!mounted || !prefsLoaded) return;
    writeSlugList("rn:favorite-leagues", favoriteSlugs);
  }, [favoriteSlugs, mounted, prefsLoaded]);

  useEffect(() => {
    if (!mounted || !prefsLoaded) return;
    writeSlugList("rn:hidden-leagues", hiddenSlugs);
  }, [hiddenSlugs, mounted, prefsLoaded]);

  useEffect(() => {
    if (!mounted || !prefsLoaded) return;
    writeOrderedKeys(SIDEBAR_SECTION_ORDER_KEY, sectionOrder);
  }, [mounted, prefsLoaded, sectionOrder]);

  useEffect(() => {
    const id = window.setInterval(() => setClockTick(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (lastPushedISO.current === selectedISO) return;
    lastPushedISO.current = selectedISO;
    router.replace(`/?date=${selectedISO}`, { scroll: false });
  }, [router, selectedISO]);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const nextToday = getISODateInTimeZone(new Date(), timeZone);
    const lastEntryDay = window.localStorage.getItem(HOME_LAST_ENTRY_DAY_KEY);

    if (lastEntryDay !== nextToday) {
      window.localStorage.setItem(HOME_LAST_ENTRY_DAY_KEY, nextToday);
      previousTodayISORef.current = nextToday;
      setSelectedISO(nextToday);
      return;
    }

    if (!hasExplicitInitialDate) {
      setSelectedISO((current) => (current === previousTodayISORef.current ? nextToday : current));
    }

    window.localStorage.setItem(HOME_LAST_ENTRY_DAY_KEY, nextToday);
    previousTodayISORef.current = nextToday;
  }, [hasExplicitInitialDate, mounted, timeZone]);

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
    let isInitialFetch = true;

    const loadMatches = async () => {
      if (isInitialFetch) {
        setLoading(true);
      }
      setLoadError("");

      const response = await fetch(`/api/home?date=${selectedISO}`, { cache: "no-store" });
      const payload = await response.json();

      if (cancelled) return;

      if (!response.ok) {
        setBlocks([]);
        setLoadError(payload.error ?? tr("unknownMatchesError"));
        setLoading(false);
        isInitialFetch = false;
        timer = setTimeout(loadMatches, 60000);
        return;
      }

      const rows = (payload.matches || []) as DbMatchRow[];
      const byLeague = new Map<string, LeagueBlock>();
      let hasLive = false;

      for (const row of rows) {
        if (isActiveMatchStatus(row.status)) hasLive = true;

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
          updatedAt: row.updated_at ?? null,
          hs: isScheduledMatchStatus(row.status) ? null : row.home_score,
          as: isScheduledMatchStatus(row.status) ? null : row.away_score,
          status: row.status,
        };

        if (!byLeague.has(leagueSlug)) {
          byLeague.set(leagueSlug, { league: leagueName, region, slug: leagueSlug, matches: [] });
        }

        byLeague.get(leagueSlug)!.matches.push(match);
      }

      setBlocks(Array.from(byLeague.values()).map(dedupeBlock));
      setLoading(false);
      isInitialFetch = false;
      timer = setTimeout(loadMatches, hasLive ? 60000 : 300000);
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
          southamerica: southAmericaGroupLabel,
          europe: europeGroupLabel,
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
      europeGroupLabel,
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
      southAmericaGroupLabel,
      spainGroupLabel,
      uruguayGroupLabel,
      usaGroupLabel,
    ]
  );

  const orderedNavigationSections = useMemo(
    () => applyNavigationSectionOrder(navigationSections, sectionOrder.length ? sectionOrder : DEFAULT_SECTION_ORDER),
    [navigationSections, sectionOrder]
  );

  const favoriteCompetitions = useMemo(
    () => {
      const rank = new Map(favoriteSlugs.map((slug, index) => [slug, index]));
      return dedupedCompetitions
        .filter((competition) => favoriteSlugs.includes(competition.slug) && !hiddenSlugs.includes(competition.slug))
        .sort((a, b) => (rank.get(a.slug) ?? 999) - (rank.get(b.slug) ?? 999));
    },
    [dedupedCompetitions, favoriteSlugs, hiddenSlugs]
  );

  const hiddenCompetitions = useMemo(
    () => dedupedCompetitions.filter((competition) => hiddenSlugs.includes(competition.slug)).sort((a, b) => a.name.localeCompare(b.name)),
    [dedupedCompetitions, hiddenSlugs]
  );

  const competitionMetaBySlug = useMemo(() => {
    const out = new Map<string, Competition>();
    for (const competition of dedupedCompetitions) {
      out.set(competition.slug, competition);
    }
    return out;
  }, [dedupedCompetitions]);

  const filteredBlocks = useMemo(() => {
    const visibleBlocks = blocks.filter((block) => !hiddenSlugs.includes(block.slug));
      const blocksForTab =
      tab !== "LIVE"
        ? visibleBlocks
        : visibleBlocks
      .map((block) => ({ ...block, matches: block.matches.filter((match) => isActiveMatchStatus(match.status)) }))
      .filter((block) => block.matches.length > 0);

    const favoriteRank = new Map(favoriteSlugs.map((slug, index) => [slug, index]));

    return blocksForTab.slice().sort((a, b) => {
      const aFavorite = favoriteRank.has(a.slug);
      const bFavorite = favoriteRank.has(b.slug);
      if (aFavorite !== bFavorite) return aFavorite ? -1 : 1;
      if (aFavorite && bFavorite) {
        return (favoriteRank.get(a.slug) ?? 999) - (favoriteRank.get(b.slug) ?? 999);
      }

      const aMeta = competitionMetaBySlug.get(a.slug);
      const bMeta = competitionMetaBySlug.get(b.slug);
      const aSort = aMeta?.sort_order ?? 9999;
      const bSort = bMeta?.sort_order ?? 9999;
      const aPriority = aMeta ? getCompetitionSortPriority(aMeta) : aSort;
      const bPriority = bMeta ? getCompetitionSortPriority(bMeta) : bSort;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aFeatured = Boolean(aMeta?.is_featured);
      const bFeatured = Boolean(bMeta?.is_featured);
      if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

      if (aSort !== bSort) return aSort - bSort;

      return a.league.localeCompare(b.league);
    });
  }, [blocks, competitionMetaBySlug, favoriteSlugs, hiddenSlugs, tab]);
  const hasHomeEditorialContent = !loading && filteredBlocks.some((block) => block.matches.length > 0);

  const isTodaySelected = Boolean(mounted && todayLocal && isSameDay(selectedDate, todayLocal));
  const dateHeroLabel = isTodaySelected ? tr("today").toUpperCase() : niceDate(selectedDate, lang);
  const defaultSidebarGroupOpen = Boolean(
    mounted && typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches
  );
  const previousDateLabel =
    todayLocal && isSameDay(previousDate, todayLocal) ? tr("today") : tr("previousDay");
  const nextDateLabel = tr("nextDay");

  const toggleFavoriteLeague = (slug: string) =>
    setFavoriteSlugs((prev) => {
      const next = toggleSlug(prev, slug);
      if (prefsLoaded) writeSlugList("rn:favorite-leagues", next);
      return next;
    });
  const moveFavoriteLeague = (slug: string, direction: -1 | 1) =>
    setFavoriteSlugs((prev) => {
      const next = moveSlug(prev, slug, direction);
      if (prefsLoaded) writeSlugList("rn:favorite-leagues", next);
      return next;
    });
  const toggleHiddenLeague = (slug: string) => setHiddenSlugs((prev) => toggleSlug(prev, slug));
  const reorderSections = (draggedKey: string, targetKey: string) =>
    setSectionOrder((prev) =>
      reorderNavigationSectionKeys(prev, draggedKey, targetKey, navigationSections.map((section) => section.key))
    );

  return (
    <div className="rn-app-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-lime-200/10 blur-3xl" />
      </div>

      <div className="relative">
        <AppHeader showTabs tab={tab} setTab={setTab} />

        <button
          onClick={toggleSidebarOpen}
          className={`fixed left-4 top-[158px] z-40 hidden h-12 items-center gap-2 rounded-2xl border border-white/15 bg-black/25 px-4 text-white backdrop-blur transition-all duration-200 hover:bg-black/35 sm:flex ${
            sidebarOpen ? "pointer-events-none opacity-0 sm:pointer-events-auto sm:opacity-100" : "opacity-100"
          }`}
          aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
        >
          <span className="flex flex-col gap-1.5">
            <span className="block h-0.5 w-6 rounded-full bg-white" />
            <span className="block h-0.5 w-6 rounded-full bg-white" />
            <span className="block h-0.5 w-6 rounded-full bg-white" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/90">{tr("leagues")}</span>
        </button>

        <main
          className={`w-full overflow-x-clip px-4 py-6 sm:px-6 xl:pr-[348px] ${
            sidebarOpen ? "xl:pl-[452px]" : "xl:pl-[172px]"
          }`}
        >
          <button
            onClick={toggleSidebarOpen}
            className={`sticky top-[160px] z-20 mb-4 flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-black/25 px-4 text-white backdrop-blur transition-all duration-200 hover:bg-black/35 sm:hidden ${
              sidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
            aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
          >
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-6 rounded-full bg-white" />
              <span className="block h-0.5 w-6 rounded-full bg-white" />
              <span className="block h-0.5 w-6 rounded-full bg-white" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/90">{tr("leagues")}</span>
          </button>

          <aside
            className={`fixed left-4 top-[212px] z-30 h-[calc(100vh-244px)] w-[calc(100vw-2rem)] max-w-[420px] space-y-4 overflow-x-hidden overflow-y-auto rounded-2xl border border-white/15 bg-[#0a4b31]/90 p-4 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              sidebarOpen ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[120%] opacity-0"
            } transition-all duration-300`}
          >
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white/90">{tr("leagues")}</div>
                      <button
                        type="button"
                        onClick={() => setSidebarOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/25 text-lg text-white/85 transition hover:bg-black/35 sm:hidden"
                        aria-label="Cerrar panel de ligas"
                      >
                  {"\u00D7"}
                </button>
              </div>

              {compLoading ? (
                <div className="text-xs text-white/70">{tr("loadingLeagues")}</div>
              ) : compError ? (
                <div className="text-xs text-red-200">{compError}</div>
              ) : (
                <div className="space-y-3">
                  {orderedNavigationSections.map((section) => {
                    const open = openGroups[section.key] ?? defaultSidebarGroupOpen;
                    const pinnedCount = section.competitions.filter((competition) => competition.is_featured).length;

                    if (section.key === "featured") {
                      const highlightedCompetitions = favoriteCompetitions;

                    return (
                        <div
                          key={section.key}
                          draggable
                          onDragStart={() => {
                            draggedSectionKeyRef.current = section.key;
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            const draggedKey = draggedSectionKeyRef.current;
                            if (draggedKey) reorderSections(draggedKey, section.key);
                            draggedSectionKeyRef.current = null;
                          }}
                          onDragEnd={() => {
                            draggedSectionKeyRef.current = null;
                          }}
                          className="rounded-xl border border-emerald-200/20 bg-emerald-300/10 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-50/85">
                            <div className="flex min-w-0 items-center gap-2">
                              <CompetitionSectionBadge badgeKey={section.badgeKey} alt={section.label} size={16} />
                              <span>{section.label}</span>
                            </div>
                            <span className="rounded-md border border-white/15 bg-black/20 px-2 py-1 text-[10px] tracking-[0.12em] text-white/65">
                              {tr("featuredPriorityBadge")}
                            </span>
                          </div>
                          <p className="hidden mb-3 text-[11px] font-semibold text-white/70">
                            {favoriteSlugs.length
                              ? "Usa Subir y Bajar para decidir qué liga querés ver primero."
                              : "Marcá una liga con estrella y después ordenala con Subir y Bajar."}
                          </p>
                          <p className="mb-3 text-[11px] font-semibold text-white/70">
                            {favoriteSlugs.length ? tr("featuredPriorityHintActive") : tr("featuredPriorityHintEmpty")}
                          </p>
                        {highlightedCompetitions.length ? (
                        <div className="space-y-2">
                            {highlightedCompetitions.map((competition) => {
                              const isFavorite = favoriteSlugs.includes(competition.slug);
                              const favoriteIndex = favoriteSlugs.indexOf(competition.slug);
                              const canMoveUp = favoriteIndex > 0;
                              const canMoveDown = favoriteIndex !== -1 && favoriteIndex < favoriteSlugs.length - 1;

                              return (
                              <div
                                key={`${section.key}-${competition.slug}-${competition.id}`}
                                className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2"
                              >
                                <div
                                  className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border px-2 text-sm font-black ${
                                    favoriteIndex !== -1
                                      ? "border-emerald-200/20 bg-emerald-300/15 text-white"
                                      : "border-white/10 bg-black/20 text-white/35"
                                  }`}
                                >
                                  {favoriteIndex !== -1 ? favoriteIndex + 1 : ""}
                                </div>
                                <Link href={`/leagues/${competition.slug}${dateQuery}`} className="flex min-w-0 flex-1 items-center gap-2">
                                  <LeagueLogo slug={competition.slug} alt={competition.name} />
                                  <span className="truncate text-sm font-medium text-white">{competition.name}</span>
                                </Link>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveFavoriteLeague(competition.slug, -1)}
                                    disabled={!isFavorite || !canMoveUp}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-base transition ${
                                      isFavorite && canMoveUp
                                        ? "border-emerald-300/35 bg-emerald-300/15 text-white hover:bg-emerald-300/25"
                                        : "cursor-not-allowed border-white/10 bg-black/20 text-white/25"
                                    }`}
                                    title={tr("moveUp")}
                                    aria-label={`${tr("moveUp")}: ${competition.name}`}
                                  >
                                    ⬆️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveFavoriteLeague(competition.slug, 1)}
                                    disabled={!isFavorite || !canMoveDown}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-base transition ${
                                      isFavorite && canMoveDown
                                        ? "border-emerald-300/35 bg-emerald-300/15 text-white hover:bg-emerald-300/25"
                                        : "cursor-not-allowed border-white/10 bg-black/20 text-white/25"
                                    }`}
                                    title={tr("moveDown")}
                                    aria-label={`${tr("moveDown")}: ${competition.name}`}
                                  >
                                    ⬇️
                                  </button>
                                </div>
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
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-3 py-4 text-sm text-white/65">
                            {tr("featuredPriorityEmpty")}
                          </div>
                        )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={section.key}
                        draggable
                        onDragStart={() => {
                          draggedSectionKeyRef.current = section.key;
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          const draggedKey = draggedSectionKeyRef.current;
                          if (draggedKey) reorderSections(draggedKey, section.key);
                          draggedSectionKeyRef.current = null;
                        }}
                        onDragEnd={() => {
                          draggedSectionKeyRef.current = null;
                        }}
                        className="overflow-hidden rounded-xl border border-white/15 bg-white/10"
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button
                            onClick={() => setOpenGroups((prev) => ({ ...prev, [section.key]: !open }))}
                            className="flex min-w-0 flex-1 items-center justify-between text-left"
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
                          <span className="shrink-0 rounded-md border border-white/15 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/65">
                            Drag
                          </span>
                        </div>

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

          <div className="mt-10 min-w-0 space-y-6 sm:mt-0">
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
                        <span className="text-lg font-extrabold text-white">{previousDateLabel}</span>
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
                          todayLocal && isSameDay(selectedDate, todayLocal)
                          ? "border-emerald-300/35 bg-emerald-400/20 text-white"
                          : "border-white/15 bg-white/10 text-white hover:bg-white/15"
                      }`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/55">
                        {isTodaySelected ? tr("weAreOn") : tr("standingOn")}
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
                        <span className="text-lg font-extrabold text-white">{nextDateLabel}</span>
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

                  {todayLocal && !isSameDay(selectedDate, todayLocal) ? (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => setSelectedISO(todayISO)}
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
                    {tr("selectedAt")}: <span className="font-semibold text-white">{niceDate(selectedDate, lang)}</span>  | {" "}
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
                        <Link
                          href={`/leagues/${block.slug}${dateQuery}`}
                          className="flex min-w-0 items-center gap-2 transition hover:text-emerald-200"
                        >
                          <LeagueLogo slug={block.slug} alt={block.league} />
                          <div className="truncate font-semibold text-white">{block.league}</div>
                        </Link>
                        <div className="text-sm text-white/70">{block.region}</div>
                      </div>

                      <div className="divide-y divide-white/10">
                        {getCompetitionNoticeKey(block.slug) ? (
                          <div className="px-4 py-3 text-xs font-semibold text-amber-50">
                            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2">
                              {tr(getCompetitionNoticeKey(block.slug)!)}
                            </div>
                          </div>
                        ) : null}
                        {block.matches.map((match, index) => {
                          const resultPending = isResultPendingMatch(
                            match.status,
                            match.matchDate,
                            match.kickoffTime,
                            match.hs,
                            match.as,
                            block.slug
                          );
                          const clockLabel = getMatchClockLabel({
                            competitionSlug: block.slug,
                            status: match.status,
                            minute: match.minute,
                            updatedAt: match.updatedAt,
                            matchDate: match.matchDate,
                            kickoffTime: match.kickoffTime,
                            homeScore: match.hs,
                            awayScore: match.as,
                            timeZone,
                            lang,
                          });
                          const contextLabel = getMatchContextLabel({
                            competitionSlug: block.slug,
                            status: match.status,
                            minute: match.minute,
                            updatedAt: match.updatedAt,
                            matchDate: match.matchDate,
                            kickoffTime: match.kickoffTime,
                            homeScore: match.hs,
                            awayScore: match.as,
                            timeZone,
                            lang,
                          });
                          const broadcasts = getBroadcastsForCompetition(block.slug);

                          return (
                            <div
                              key={`${block.slug}-${index}-${match.matchDate}-${match.kickoffTime ?? ""}-${match.home}-${match.away}`}
                              className={`flex flex-col gap-3 px-4 py-3 transition ${
                                isActiveMatchStatus(match.status) ? "bg-red-400/10 ring-1 ring-red-300/40" : "hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-start gap-4">
                            <div className="w-32 shrink-0">
                              <div className="text-lg font-extrabold tracking-tight text-white">{clockLabel}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <StatusBadge status={match.status} lang={lang} resultPending={resultPending} />
                                <span className="text-[11px] font-semibold text-white/70">{contextLabel}</span>
                              </div>
                            </div>

                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                                <TeamName name={match.home} slug={match.homeSlug} />
                                <span className="font-extrabold tabular-nums text-white">{isScheduledMatchStatus(match.status) ? "-" : match.hs ?? "-"}</span>
                              </div>
                              <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                                <TeamName name={match.away} slug={match.awaySlug} />
                                <span className="font-extrabold tabular-nums text-white">{isScheduledMatchStatus(match.status) ? "-" : match.as ?? "-"}</span>
                              </div>
                            </div>

                            <div className="hidden w-36 shrink-0 text-right text-xs text-white/70 md:block">
                              {resultPending
                                ? tr("resultPending")
                                : isActiveMatchStatus(match.status)
                                ? tr("liveAction")
                                : match.status === "FT"
                                  ? tr("final")
                                  : match.status === "CANC"
                                    ? tr("cancelled")
                                    : tr("upcoming")}
                            </div>
                              </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 pl-0 sm:pl-32">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              {broadcasts.length ? (
                                <>
                                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                                    {tr("watchOn")}
                                  </span>
                                  {broadcasts.map((provider) => (
                                    <BroadcastPill key={`${block.slug}-${provider.id}`} provider={provider} compact />
                                  ))}
                                </>
                              ) : null}
                            </div>
                            <SuggestedWatchButton
                              competitionSlug={block.slug}
                              competitionName={block.league}
                              home={match.home}
                              away={match.away}
                              lang={lang}
                            />
                          </div>
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

        <footer className={`w-full px-4 py-8 text-xs text-white/70 sm:px-6 xl:pr-[348px] ${sidebarOpen ? "xl:pl-[452px]" : "xl:pl-[172px]"}`}>
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

