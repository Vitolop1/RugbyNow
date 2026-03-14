"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import AdSlot from "@/app/components/AdSlot";
import BrandWordmark from "@/app/components/BrandWordmark";
import BroadcastPill from "@/app/components/BroadcastPill";
import CompetitionSectionBadge from "@/app/components/CompetitionSectionBadge";
import SuggestedWatchButton from "@/app/components/SuggestedWatchButton";
import {
  applyNavigationSectionOrder,
  buildCompetitionNavigationSections,
  moveSlug,
  readOrderedKeys,
  reorderNavigationSectionKeys,
  readSlugList,
  toggleSlug,
  writeOrderedKeys,
  writeSlugList,
} from "@/lib/competitionPrefs";
import { getDateLocale } from "@/lib/dateLocale";
import { t } from "@/lib/i18n";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
import { getBroadcastsForCompetition } from "@/lib/broadcasts";
import { getMatchClockLabel, getMatchContextLabel } from "@/lib/matchPresentation";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";
import { usePrefs } from "@/lib/usePrefs";

type MatchStatus = "NS" | "LIVE" | "FT";

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

type LeagueMatch = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  round?: number | null;
  home_team: { id: number; name: string; slug: string | null } | null;
  away_team: { id: number; name: string; slug: string | null } | null;
};

type StandingRow = {
  position: number;
  teamId: number;
  team: string;
  teamSlug: string | null;
  pj: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pts: number;
  badge?: string | null;
  form?: Array<"W" | "D" | "L">;
};

type RoundMeta = {
  round: number;
  first_date: string;
  last_date: string;
  matches?: number;
  ft?: number;
  phaseKey?: string | null;
};

type LeaguePayload = {
  competition: Competition;
  season: { id: number; name: string } | null;
  competitions: Competition[];
  roundMeta: RoundMeta[];
  selectedRound: number | null;
  matches: LeagueMatch[];
  standings: StandingRow[];
  standingsSource?: "cache" | "computed";
  source?: string;
  warning?: string;
};

type LeagueTab = "overview" | "teams" | "champions";

type LeagueTeamCard = {
  id: number;
  name: string;
  slug: string | null;
  position?: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  points?: number;
  form?: Array<"W" | "D" | "L">;
};

function FormPill({ value, lang }: { value: "W" | "D" | "L"; lang: "en" | "es" | "fr" | "it" }) {
  const tr = (key: string) => t(lang, key);
  const cls =
    value === "W"
      ? "bg-green-500/90 text-white"
      : value === "D"
        ? "bg-amber-400/90 text-black"
        : "bg-red-500/90 text-white";
  const label = value === "W" ? tr("formWin") : value === "D" ? tr("formDraw") : tr("formLoss");
  const title = value === "W" ? tr("formWinLabel") : value === "D" ? tr("formDrawLabel") : tr("formLossLabel");
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black ${cls}`}
      title={title}
    >
      {label}
    </span>
  );
}

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

function TeamLink({
  slug,
  name,
  fallback,
}: {
  slug?: string | null;
  name?: string | null;
  fallback: string;
}) {
  const label = name || fallback;
  const content = (
    <>
      <TeamLogo slug={slug} alt={label} />
      <span className="truncate">{label}</span>
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

function phaseLabel(tr: (key: string) => string, phaseKey?: string | null) {
  if (!phaseKey) return null;
  if (phaseKey === "round32") return tr("phaseRound32");
  if (phaseKey === "round16") return tr("phaseRound16");
  if (phaseKey === "quarterfinal") return tr("phaseQuarterfinal");
  if (phaseKey === "semifinal") return tr("phaseSemifinal");
  if (phaseKey === "final") return tr("phaseFinal");
  return null;
}

const LEAGUE_SIDEBAR_KEY = "rn:league-sidebar-open";
const SIDEBAR_SECTION_ORDER_KEY = "rn:league-section-order";

function getInitialLeagueSidebarOpen() {
  return false;
}

function readSidebarPreference(storageKey: string) {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(storageKey);
  if (saved === "true") return true;
  if (saved === "false") return false;
  return null;
}

function formatRoundDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function niceDate(iso: string, lang: "en" | "es" | "fr" | "it") {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(getDateLocale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LeagueClient() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang, mounted, timeZone, theme } = usePrefs();
  const tr = (key: string) => t(lang, key);
  const otherGroupLabel = tr("groupsOther");
  const featuredGroupLabel = tr("groupsFeatured");
  const franchisesGroupLabel = tr("groupsFranchises");
  const selectionsGroupLabel = tr("groupsSelections");
  const argentinaGroupLabel = tr("groupsArgentina");
  const southAmericaGroupLabel = tr("groupsSouthAmerica");
  const europeGroupLabel = tr("groupsEurope");
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

  const slug = params.slug;
  const explicitDate = searchParams.get("date");
  const refISO = explicitDate || getISODateInTimeZone(new Date(), mounted ? timeZone : "America/New_York");
  const roundFromUrl = searchParams.get("round");

  const [sidebarOpen, setSidebarOpen] = useState(getInitialLeagueSidebarOpen);
  const [sidebarGroups, setSidebarGroups] = useState<Record<string, boolean>>({});
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [hiddenSlugs, setHiddenSlugs] = useState<string[]>([]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const draggedSectionKeyRef = useRef<string | null>(null);
  const roundStripRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<LeagueTab>("overview");
  const [data, setData] = useState<LeaguePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setClockTick] = useState(0);
  const leagueBannerSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEAGUE_BANNER;
  const leagueRailSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEAGUE_RAIL;

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const desktopSidebar = window.matchMedia("(min-width: 1024px)");
    const syncSidebar = () => {
      const saved = readSidebarPreference(LEAGUE_SIDEBAR_KEY);
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
        window.localStorage.setItem(LEAGUE_SIDEBAR_KEY, String(next));
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
    const id = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      setLoading(true);
      setError("");

      const qs = new URLSearchParams();
      if (refISO) qs.set("date", refISO);
      if (roundFromUrl) qs.set("round", roundFromUrl);

      const response = await fetch(`/api/leagues/${slug}?${qs.toString()}`, { cache: "no-store" });
      const payload = await response.json();

      if (cancelled) return;

      if (!response.ok) {
        setData(null);
        setError(payload.error ?? tr("unknownLeagueError"));
      } else {
        setData(payload as LeaguePayload);
        if (payload.warning) setError(payload.warning);
      }

      setLoading(false);

      const hasLive = (payload.matches || []).some((match: LeagueMatch) => match.status === "LIVE");
      timer = setTimeout(load, hasLive ? 30000 : 180000);
    };

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [slug, refISO, roundFromUrl]);

  const navigationSections = useMemo(
    () =>
      buildCompetitionNavigationSections(
        (data?.competitions || []).filter((competition) => !hiddenSlugs.includes(competition.slug)),
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
      data?.competitions,
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
    () => applyNavigationSectionOrder(navigationSections, sectionOrder),
    [navigationSections, sectionOrder]
  );

  const favoriteCompetitions = useMemo(
    () => {
      const rank = new Map(favoriteSlugs.map((leagueSlug, index) => [leagueSlug, index]));
      return (data?.competitions || [])
        .filter((competition) => favoriteSlugs.includes(competition.slug) && !hiddenSlugs.includes(competition.slug))
        .sort((a, b) => (rank.get(a.slug) ?? 999) - (rank.get(b.slug) ?? 999));
    },
    [data?.competitions, favoriteSlugs, hiddenSlugs]
  );

  const hiddenCompetitions = useMemo(
    () =>
      (data?.competitions || [])
        .filter((competition) => hiddenSlugs.includes(competition.slug))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data?.competitions, hiddenSlugs]
  );

  const selectedRound = data?.selectedRound ?? null;
  const defaultSidebarGroupOpen = Boolean(
    mounted && typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches
  );
  const roundMeta = data?.roundMeta || [];
  const selectedRoundMeta = roundMeta.find((item) => item.round === selectedRound) ?? null;
  const canGoPrevRound = selectedRound != null && roundMeta.some((item) => item.round < selectedRound);
  const canGoNextRound = selectedRound != null && roundMeta.some((item) => item.round > selectedRound);
  const visibleMatches = data?.competition && hiddenSlugs.includes(data.competition.slug) ? [] : data?.matches || [];
  const leagueTeams = useMemo(() => {
    const byId = new Map<number, LeagueTeamCard>();

    for (const row of data?.standings || []) {
      byId.set(row.teamId, {
        id: row.teamId,
        name: row.team,
        slug: row.teamSlug,
        position: row.position,
        played: row.pj,
        wins: row.w,
        draws: row.d,
        losses: row.l,
        points: row.pts,
        form: row.form || [],
      });
    }

    for (const match of data?.matches || []) {
      if (match.home_team?.id && !byId.has(match.home_team.id)) {
        byId.set(match.home_team.id, {
          id: match.home_team.id,
          name: match.home_team.name,
          slug: match.home_team.slug,
        });
      }
      if (match.away_team?.id && !byId.has(match.away_team.id)) {
        byId.set(match.away_team.id, {
          id: match.away_team.id,
          name: match.away_team.name,
          slug: match.away_team.slug,
        });
      }
    }

    return Array.from(byId.values()).sort((a, b) => {
      const posA = a.position ?? 9999;
      const posB = b.position ?? 9999;
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name);
    });
  }, [data?.matches, data?.standings]);
  const topTeams = useMemo(() => leagueTeams.filter((team) => team.position != null).slice(0, 12), [leagueTeams]);
  const hasLeagueEditorialContent =
    !loading &&
    !!data &&
    ((activeTab === "overview" && (visibleMatches.length > 0 || data.standings.length > 0)) ||
      (activeTab === "teams" && leagueTeams.length > 0) ||
      (activeTab === "champions" && topTeams.length > 0));

  const setRound = (nextRound: number) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("round", String(nextRound));
    router.replace(`/leagues/${slug}?${qs.toString()}`, { scroll: false });
  };

  const moveRound = (dir: -1 | 1) => {
    if (selectedRound == null) return;
    const rounds = roundMeta.map((item) => item.round).sort((a, b) => a - b);
    const index = rounds.indexOf(selectedRound);
    const next = rounds[index + dir];
    if (next != null) setRound(next);
  };

  useEffect(() => {
    if (!roundStripRef.current || selectedRound == null) return;

    const activeButton = roundStripRef.current.querySelector<HTMLButtonElement>(
      `[data-round="${selectedRound}"]`
    );

    if (!activeButton) return;

    requestAnimationFrame(() => {
      activeButton.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  }, [selectedRound, roundMeta.length]);

  const seasonName = data?.season?.name || "-";
  const toggleFavoriteLeague = (nextSlug: string) =>
    setFavoriteSlugs((prev) => {
      const next = toggleSlug(prev, nextSlug);
      if (prefsLoaded) writeSlugList("rn:favorite-leagues", next);
      return next;
    });
  const moveFavoriteLeague = (nextSlug: string, direction: -1 | 1) =>
    setFavoriteSlugs((prev) => {
      const next = moveSlug(prev, nextSlug, direction);
      if (prefsLoaded) writeSlugList("rn:favorite-leagues", next);
      return next;
    });
  const toggleHiddenLeague = (nextSlug: string) => setHiddenSlugs((prev) => toggleSlug(prev, nextSlug));
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
        <AppHeader />

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
            sidebarOpen ? "xl:pl-[412px]" : "xl:pl-[156px]"
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
            className={`fixed left-4 top-[212px] z-30 h-[calc(100vh-244px)] w-[calc(100vw-2rem)] max-w-[380px] space-y-4 overflow-x-hidden overflow-y-auto rounded-2xl border border-white/15 bg-[#0a4b31]/90 p-4 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              sidebarOpen ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-[120%] opacity-0"
            } transition-all duration-300`}
          >
            <div className="flex items-center justify-between gap-3 sm:hidden">
              <div className="text-sm font-semibold text-white/90">{tr("leagues")}</div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/25 text-lg text-white/85 transition hover:bg-black/35"
                aria-label="Cerrar panel de ligas"
              >
                {"\u00D7"}
              </button>
            </div>

            {data?.competition ? (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="text-sm font-semibold text-white/85">{tr("league")}</div>
                <div className="mt-3 flex items-center gap-3">
                  <LeagueLogo slug={data.competition.slug} alt={data.competition.name} size={28} />
                  <div className="min-w-0">
                    <div className="truncate text-lg font-extrabold text-white">{data.competition.name}</div>
                    <div className="text-sm text-white/70">
                      {tr("seasonLabel")}: {seasonName}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-2 hidden text-sm font-semibold text-white/90 sm:block">{tr("leagues")}</div>
                <div className="space-y-3">
                  {orderedNavigationSections.map((section) => {
                  const open = sidebarGroups[section.key] ?? defaultSidebarGroupOpen;
                  const pinnedCount = section.competitions.filter((competition) => competition.is_featured).length;

                  if (section.key === "featured") {
                    const highlightedCompetitions = favoriteCompetitions.length ? favoriteCompetitions : section.competitions;

                    if (!highlightedCompetitions.length) {
                      return null;
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
                        className="rounded-xl border border-emerald-200/20 bg-emerald-300/10 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-50/85">
                          <div className="flex min-w-0 items-center gap-2">
                            <CompetitionSectionBadge badgeKey={section.badgeKey} alt={section.label} size={16} />
                            <span>{section.label}</span>
                          </div>
                          <span className="rounded-md border border-white/15 bg-black/20 px-2 py-1 text-[10px] tracking-[0.12em] text-white/65">Top</span>
                        </div>
                        <p className="mb-3 text-[11px] font-semibold text-white/70">
                          {favoriteSlugs.length
                            ? "Usa Subir y Bajar para decidir qué liga querés ver primero."
                            : "Marcá una liga con estrella y después ordenala con Subir y Bajar."}
                        </p>
                        <div className="space-y-2">
                          {highlightedCompetitions.map((competition) => {
                            const active = competition.slug === slug;
                            const isFavorite = favoriteSlugs.includes(competition.slug);
                            const favoriteIndex = favoriteSlugs.indexOf(competition.slug);
                            const canMoveUp = favoriteIndex > 0;
                            const canMoveDown = favoriteIndex !== -1 && favoriteIndex < favoriteSlugs.length - 1;
                            return (
                              <Link
                                key={`${section.key}-${competition.slug}-${competition.id}`}
                                href={`/leagues/${competition.slug}?date=${refISO}`}
                                className={`block rounded-xl border px-3 py-2 transition ${
                                  active
                                    ? "border-emerald-300/35 bg-emerald-300/15"
                                    : "border-white/15 bg-black/20 hover:bg-black/30"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-300/15 px-2 text-sm font-black text-white">
                                      {favoriteIndex !== -1 ? favoriteIndex + 1 : "•"}
                                    </div>
                                    <LeagueLogo slug={competition.slug} alt={competition.name} />
                                    <div className="truncate text-sm font-medium text-white">{competition.name}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        moveFavoriteLeague(competition.slug, -1);
                                      }}
                                      disabled={!isFavorite || !canMoveUp}
                                      className={`inline-flex h-8 shrink-0 items-center justify-center rounded-xl border px-2.5 text-[11px] font-black uppercase tracking-[0.08em] transition ${
                                        isFavorite && canMoveUp
                                          ? "border-emerald-300/35 bg-emerald-300/15 text-white hover:bg-emerald-300/25"
                                          : "cursor-not-allowed border-white/10 bg-black/20 text-white/25"
                                      }`}
                                      title="Mover arriba"
                                      aria-label={`Mover ${competition.name} arriba`}
                                    >
                                      Subir
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        moveFavoriteLeague(competition.slug, 1);
                                      }}
                                      disabled={!isFavorite || !canMoveDown}
                                      className={`inline-flex h-8 shrink-0 items-center justify-center rounded-xl border px-2.5 text-[11px] font-black uppercase tracking-[0.08em] transition ${
                                        isFavorite && canMoveDown
                                          ? "border-emerald-300/35 bg-emerald-300/15 text-white hover:bg-emerald-300/25"
                                          : "cursor-not-allowed border-white/10 bg-black/20 text-white/25"
                                      }`}
                                      title="Mover abajo"
                                      aria-label={`Mover ${competition.name} abajo`}
                                    >
                                      Bajar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        toggleFavoriteLeague(competition.slug);
                                      }}
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
                                      onClick={(event) => {
                                        event.preventDefault();
                                        toggleHiddenLeague(competition.slug);
                                      }}
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-sm text-white/70 transition hover:bg-black/35"
                                      title={tr("hideLeague")}
                                      aria-label={tr("hideLeague")}
                                    >
                                      {"\u{1F441}"}
                                    </button>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
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
                          onClick={() => setSidebarGroups((prev) => ({ ...prev, [section.key]: !open }))}
                          className="flex min-w-0 flex-1 items-center justify-between text-left"
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
                          {section.competitions.map((competition) => {
                            const active = competition.slug === slug;
                            return (
                              <Link
                                key={`${section.key}-${competition.slug}-${competition.id}`}
                                href={`/leagues/${competition.slug}?date=${refISO}`}
                                className={`block rounded-xl border px-3 py-2 transition ${
                                  active
                                    ? "border-emerald-300/35 bg-emerald-300/15"
                                    : "border-white/15 bg-black/20 hover:bg-black/30"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <LeagueLogo slug={competition.slug} alt={competition.name} />
                                    <div className="truncate text-sm font-medium text-white">{competition.name}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        toggleFavoriteLeague(competition.slug);
                                      }}
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
                                      onClick={(event) => {
                                        event.preventDefault();
                                        toggleHiddenLeague(competition.slug);
                                      }}
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-sm text-white/70 transition hover:bg-black/35"
                                      title={tr("hideLeague")}
                                      aria-label={tr("hideLeague")}
                                    >
                                      {"\u{1F441}"}
                                    </button>
                                    {competition.is_featured ? (
                                      <span className="rounded-full border border-emerald-200/30 bg-emerald-300/25 px-2 py-1 text-[10px] font-extrabold text-white">
                                        {tr("pinned")}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {competition.region ? <div className="mt-1 text-xs text-white/70">{competition.region}</div> : null}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {hiddenCompetitions.length ? (
                  <div className="rounded-xl border border-white/15 bg-black/20 p-3">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/70">{tr("hiddenLeagues")}</div>
                    <div className="space-y-2">
                      {hiddenCompetitions.map((competition) => (
                        <div
                          key={`hidden-${competition.slug}`}
                          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <LeagueLogo slug={competition.slug} alt={competition.name} />
                          <span className="min-w-0 flex-1 truncate text-sm text-white/85">{competition.name}</span>
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
            </div>
          </aside>

          <div className="mt-10 space-y-6 sm:mt-0">
            {loading ? (
              <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-center text-white/80 backdrop-blur">
                {tr("loadingLeague")}
              </div>
            ) : !data ? (
              <div className="rounded-2xl border border-red-200/30 bg-black/20 p-6 text-white backdrop-blur">
                <div className="font-bold">{tr("loadError")}</div>
                <div className="mt-2 text-sm text-white/80">{error || tr("unknownLeagueError")}</div>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur">
                  <div className="grid grid-cols-1 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab("overview")}
                      className={`px-4 py-4 text-sm font-black uppercase tracking-[0.16em] transition ${
                        activeTab === "overview"
                          ? "border-b-4 border-emerald-300 bg-emerald-300/25 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
                          : "bg-transparent text-white/45 hover:bg-white/5 hover:text-white/80"
                      }`}
                    >
                      {tr("overviewTab")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("teams")}
                      className={`border-t border-white/10 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] transition sm:border-l sm:border-t-0 ${
                        activeTab === "teams"
                          ? "border-b-4 border-emerald-300 bg-emerald-300/25 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
                          : "bg-transparent text-white/45 hover:bg-white/5 hover:text-white/80"
                      }`}
                    >
                      {tr("teamsTab")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("champions")}
                      className={`border-t border-white/10 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] transition sm:border-l sm:border-t-0 ${
                        activeTab === "champions"
                          ? "border-b-4 border-emerald-300 bg-emerald-300/25 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
                          : "bg-transparent text-white/45 hover:bg-white/5 hover:text-white/80"
                      }`}
                    >
                      {tr("championsTab")}
                    </button>
                  </div>
                </div>

                {activeTab === "overview" ? (
                <div className="flex min-w-0 flex-col gap-6 xl:flex-row">
                  <section className="min-w-0 flex-1 space-y-4">
                    <div className="rounded-2xl border border-white/15 bg-black/20 p-4 backdrop-blur">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-white/90">{tr("round")}</div>
                          <div className="mt-1 text-sm text-white/70">
                            {tr("seasonLabel")}: {seasonName}
                          </div>
                        </div>
                        {selectedRoundMeta ? (
                          <div className="text-right text-sm text-white/75">
                            <div className="font-bold text-white">#{selectedRoundMeta.round}</div>
                            <div>{formatRoundDate(selectedRoundMeta.first_date)}</div>
                          </div>
                        ) : null}
                      </div>

                      {roundMeta.length > 0 ? (
                        <div className="mt-4 flex items-center gap-3 overflow-hidden">
                          <button
                            onClick={() => moveRound(-1)}
                            disabled={!canGoPrevRound}
                            aria-label={tr("previous")}
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-xl font-black transition ${
                              canGoPrevRound
                                ? "border-emerald-300/30 bg-emerald-400/25 text-white hover:bg-emerald-400/35"
                                : "border-white/10 bg-white/5 text-white/30"
                            }`}
                          >
                            &lt;
                          </button>

                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div
                              ref={roundStripRef}
                              className="flex w-full gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
                            >
                                {roundMeta.map((item) => {
                                  const active = item.round === selectedRound;
                                  return (
                                    <button
                                      key={item.round}
                                      data-round={item.round}
                                      onClick={() => setRound(item.round)}
                                      className={`shrink-0 rounded-2xl border px-4 py-2 text-center transition ${
                                        active
                                          ? "border-emerald-300/35 bg-emerald-400/25 text-white"
                                          : "border-white/15 bg-white/10 text-white/85 hover:bg-white/15"
                                      }`}
                                    >
                                      <div className="text-xl font-black leading-none">{item.round}</div>
                                      <div className="mt-1 text-[11px] font-semibold text-white/70">{formatRoundDate(item.first_date)}</div>
                                      {phaseLabel(tr, item.phaseKey) ? (
                                        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/80">
                                          {phaseLabel(tr, item.phaseKey)}
                                        </div>
                                      ) : null}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>

                          <button
                            onClick={() => moveRound(1)}
                            disabled={!canGoNextRound}
                            aria-label={tr("next")}
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-xl font-black transition ${
                              canGoNextRound
                                ? "border-emerald-300/30 bg-emerald-400/25 text-white hover:bg-emerald-400/35"
                                : "border-white/10 bg-white/5 text-white/30"
                            }`}
                          >
                            &gt;
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-white">{tr("matches")}</h2>
                      <p className="text-sm text-white/80">
                        {tr("seasonLabel")}: <span className="font-semibold text-white">{seasonName}</span>  |  {tr("round")}:{" "}
                        <span className="font-semibold text-white">{selectedRound ?? "-"}</span>  |  {tr("tz")}:{" "}
                        <span className="font-semibold text-white">{timeZone}</span>
                      </p>
                    </div>

                    {visibleMatches.length === 0 ? (
                      <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-center text-white/80 backdrop-blur">
                        {selectedRound == null ? tr("noMatchesSeason") : tr("noMatchesRound")}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur">
                        <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <LeagueLogo slug={data.competition.slug} alt={data.competition.name} />
                            <div className="truncate font-semibold text-white">{data.competition.name}</div>
                          </div>
                          <div className="text-sm text-white/70">{data.competition.region}</div>
                        </div>

                        <div className="divide-y divide-white/10">
                          {visibleMatches.map((match) => {
                            const clockLabel = getMatchClockLabel({
                              status: match.status,
                              minute: match.minute,
                              matchDate: match.match_date,
                              kickoffTime: match.kickoff_time,
                              timeZone,
                              lang,
                            });
                            const contextLabel = getMatchContextLabel({
                              status: match.status,
                              minute: match.minute,
                              matchDate: match.match_date,
                              kickoffTime: match.kickoff_time,
                              timeZone,
                              lang,
                            });
                            const broadcasts = getBroadcastsForCompetition(data.competition.slug);

                            return (
                              <div
                                key={match.id}
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
                                    <TeamLink slug={match.home_team?.slug} name={match.home_team?.name} fallback={tr("teamHomeFallback")} />
                                    <span className="font-extrabold tabular-nums text-white">
                                      {match.status === "NS" ? "-" : match.home_score ?? "-"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                                    <TeamLink slug={match.away_team?.slug} name={match.away_team?.name} fallback={tr("teamAwayFallback")} />
                                    <span className="font-extrabold tabular-nums text-white">
                                      {match.status === "NS" ? "-" : match.away_score ?? "-"}
                                    </span>
                                  </div>
                                </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pl-0 sm:pl-32">
                                  <span className="text-xs text-white/70">{niceDate(match.match_date, lang)}</span>
                                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-3">
                                    {broadcasts.length ? (
                                      <div className="flex flex-wrap items-center justify-end gap-2">
                                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                                          {tr("watchOn")}
                                        </span>
                                        {broadcasts.map((provider) => (
                                          <BroadcastPill key={`${match.id}-${provider.id}`} provider={provider} compact />
                                        ))}
                                      </div>
                                    ) : null}
                                    <SuggestedWatchButton
                                      competitionSlug={data.competition.slug}
                                      competitionName={data.competition.name}
                                      home={match.home_team?.name}
                                      away={match.away_team?.name}
                                      lang={lang}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur">
                      <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
                        <div>
                          <div className="text-xl font-bold text-white">{tr("standings")}</div>
                          <div className="mt-1 text-sm text-white/70">
                            {data.standingsSource === "cache" ? tr("scrapedStandings") : tr("computedFromFT")}
                          </div>
                        </div>
                        <div className="text-sm text-white/70">
                          {tr("seasonLabel")}: {seasonName}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-white/5 text-white/70">
                            <tr>
                              <th className="px-4 py-3 text-left">#</th>
                              <th className="px-4 py-3 text-left">{tr("teamLabel")}</th>
                              <th className="px-3 py-3 text-right">PJ</th>
                              <th className="px-3 py-3 text-right">W</th>
                              <th className="px-3 py-3 text-right">D</th>
                              <th className="px-3 py-3 text-right">L</th>
                              <th className="px-3 py-3 text-right">PF</th>
                              <th className="px-3 py-3 text-right">PA</th>
                              <th className="px-3 py-3 text-center">{tr("recentForm")}</th>
                              <th className="px-4 py-3 text-right">PTS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.standings.map((row) => (
                              <tr key={row.teamId} className="border-t border-white/10">
                                <td className="px-4 py-3 text-white/80">{row.position}</td>
                                <td className="px-4 py-3">
                                  <TeamLink slug={row.teamSlug} name={row.team} fallback={tr("teamLabel")} />
                                </td>
                                <td className="px-3 py-3 text-right">{row.pj}</td>
                                <td className="px-3 py-3 text-right">{row.w}</td>
                                <td className="px-3 py-3 text-right">{row.d}</td>
                                <td className="px-3 py-3 text-right">{row.l}</td>
                                <td className="px-3 py-3 text-right">{row.pf}</td>
                                <td className="px-3 py-3 text-right">{row.pa}</td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {(row.form || []).map((value, index) => (
                                      <FormPill key={`${row.teamId}-${index}-${value}`} value={value} lang={lang} />
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-extrabold text-white">{row.pts}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {hasLeagueEditorialContent ? (
                      <AdSlot
                        slot={leagueBannerSlot}
                        format="horizontal"
                        minHeight={140}
                        fallbackTitle="Banner premium RugbyNow"
                        fallbackSubtitle="Espacio horizontal para anuncios debajo de la tabla."
                        className="hidden min-h-[140px] w-full lg:block"
                      />
                    ) : null}
                  </section>
                </div>
                ) : null}

                {activeTab === "teams" ? (
                  <section className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{tr("teamsTab")}</div>
                        <div className="mt-2 text-3xl font-black text-white">{leagueTeams.length}</div>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{tr("matches")}</div>
                        <div className="mt-2 text-3xl font-black text-white">{data.matches.length}</div>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">FT</div>
                        <div className="mt-2 text-3xl font-black text-white">{data.matches.filter((match) => match.status === "FT").length}</div>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{tr("seasonLabel")}</div>
                        <div className="mt-2 truncate text-2xl font-black text-white">{seasonName}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-black text-white">{tr("teamsTab")}</h2>
                          <p className="text-sm text-white/70">{tr("leagueTeamsIntro")}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {leagueTeams.map((team) => (
                          <Link
                            key={team.id}
                            href={team.slug ? `/teams/${team.slug}` : "#"}
                            className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <TeamLogo slug={team.slug} alt={team.name} size={38} />
                              <div className="min-w-0">
                                <div className="truncate text-base font-bold text-white">{team.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/65">
                                  {team.position != null ? <span>#{team.position}</span> : null}
                                  {team.points != null ? <span>PTS {team.points}</span> : null}
                                  {team.played != null ? <span>PJ {team.played}</span> : null}
                                </div>
                              </div>
                            </div>

                            {team.form?.length ? (
                              <div className="mt-3 flex gap-1.5">
                                {team.form.map((value, index) => (
                                  <FormPill key={`${team.id}-${index}-${value}`} value={value} lang={lang} />
                                ))}
                              </div>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeTab === "champions" ? (
                  <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                      <h2 className="text-xl font-black text-white">{tr("champions")}</h2>
                      <p className="mt-2 text-sm leading-7 text-white/75">
                        {tr("championsIntro")}
                      </p>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{tr("seasonLabel")}</div>
                        <div className="mt-2 text-2xl font-black text-white">{seasonName}</div>
                        <div className="mt-2 text-sm text-white/70">
                          {data.competition.name}  |  {data.competition.region || "RugbyNow"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{tr("currentTopTeams")}</div>
                      <div className="mt-4 space-y-3">
                        {topTeams.map((team) => (
                          <div key={`champions-${team.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-black text-white">
                              {team.position ?? "-"}
                            </div>
                            <TeamLogo slug={team.slug} alt={team.name} size={28} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold text-white">{team.name}</div>
                              <div className="text-xs text-white/65">
                                {team.points != null ? `PTS ${team.points}` : ""}{team.played != null ? `  |  PJ ${team.played}` : ""}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </main>

        {hasLeagueEditorialContent ? (
          <div className="pointer-events-none fixed bottom-0 right-4 top-[145px] z-20 hidden w-[320px] py-4 xl:block">
            <AdSlot
              slot={leagueRailSlot}
              format="vertical"
              minHeight={600}
              fallbackTitle="Tu marca puede vivir aca"
              fallbackSubtitle="Espacio vertical para sponsors, promos o publicidad propia de RugbyNow."
              className="h-full"
            />
          </div>
        ) : null}

        <footer className={`w-full px-4 py-8 text-xs text-white/70 sm:px-6 xl:pr-[348px] ${sidebarOpen ? "xl:pl-[412px]" : "xl:pl-[156px]"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <BrandWordmark
                key={`league-footer-brand-${theme}`}
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

