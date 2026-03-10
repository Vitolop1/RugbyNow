"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import AdSlot from "@/app/components/AdSlot";
import { getCompetitionEmoji } from "@/lib/competitionMeta";
import { t } from "@/lib/i18n";
import { getLeagueLogo, getTeamLogo } from "@/lib/assets";
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

function countryCodeToFlag(code?: string | null) {
  if (!code || code.length !== 2) return null;
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

function competitionFlag(competition?: Competition | null) {
  if (!competition) return "R";
  return (
    getCompetitionEmoji(competition.slug, competition.group_name, competition.country_code) ||
    countryCodeToFlag(competition.country_code) ||
    "R"
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

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getInitialLeagueSidebarOpen() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("rn:league-sidebar-open") !== "0";
}

function formatRoundDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function niceDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatKickoffTZ(matchDate: string, kickoffTime: string | null, timeZone: string) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(`${matchDate}T${normalized}`)
  );
}

function groupCompetitions(competitions: Competition[], otherLabel: string) {
  const groups = new Map<string, Competition[]>();
  for (const competition of competitions) {
    const group = (competition.group_name ?? "").trim() || otherLabel;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(competition);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([groupName, comps]) => [
      groupName,
      comps.sort((a, b) => {
        if (!!a.is_featured !== !!b.is_featured) return a.is_featured ? -1 : 1;
        const aSort = a.sort_order ?? 9999;
        const bSort = b.sort_order ?? 9999;
        if (aSort !== bSort) return aSort - bSort;
        return a.name.localeCompare(b.name);
      }),
    ] as const);
}

export default function LeagueClient() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang, mounted, timeZone } = usePrefs();
  const tr = (key: string) => t(lang, key);
  const otherGroupLabel = tr("groupsOther");

  const slug = params.slug;
  const refISO = searchParams.get("date") || toISODateLocal(new Date());
  const roundFromUrl = searchParams.get("round");

  const [sidebarOpen, setSidebarOpen] = useState(getInitialLeagueSidebarOpen);
  const [sidebarGroups, setSidebarGroups] = useState<Record<string, boolean>>({});
  const [data, setData] = useState<LeaguePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const leagueBannerSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEAGUE_BANNER;
  const leagueRailSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEAGUE_RAIL;

  const roundsScrollRef = useRef<HTMLDivElement | null>(null);
  const activeRoundRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    window.localStorage.setItem("rn:league-sidebar-open", sidebarOpen ? "1" : "0");
  }, [mounted, sidebarOpen]);

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
      timer = setTimeout(load, hasLive ? 10000 : 60000);
    };

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [slug, refISO, roundFromUrl]);

  useEffect(() => {
    activeRoundRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [data?.selectedRound]);

  const groupedCompetitions = useMemo(
    () => groupCompetitions(data?.competitions || [], otherGroupLabel),
    [data?.competitions, otherGroupLabel]
  );

  const selectedRound = data?.selectedRound ?? null;
  const roundMeta = data?.roundMeta || [];
  const selectedRoundMeta = roundMeta.find((item) => item.round === selectedRound) ?? null;
  const canGoPrevRound = selectedRound != null && roundMeta.some((item) => item.round < selectedRound);
  const canGoNextRound = selectedRound != null && roundMeta.some((item) => item.round > selectedRound);

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

  const title = data?.competition?.name || tr("leagueView");
  const seasonName = data?.season?.name || "—";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E4F33] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-lime-200/10 blur-3xl" />
      </div>

      <div className="relative">
        <AppHeader title={title} subtitle={data?.competition?.region ?? undefined} />

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
            {data?.competition ? (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="text-sm font-semibold text-white/85">{tr("league")}</div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xl">{competitionFlag(data.competition)}</span>
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
              <div className="mb-2 text-sm font-semibold text-white/90">{tr("leagues")}</div>
              <div className="space-y-3">
                {groupedCompetitions.map(([groupName, comps]) => {
                  const open = sidebarGroups[groupName] ?? true;
                  const featuredCount = comps.filter((competition) => competition.is_featured).length;

                  return (
                    <div key={groupName} className="overflow-hidden rounded-xl border border-white/15 bg-white/10">
                      <button
                        onClick={() => setSidebarGroups((prev) => ({ ...prev, [groupName]: !open }))}
                        className="flex w-full items-center justify-between px-3 py-2 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate text-sm font-extrabold text-white">
                            <span>{getCompetitionEmoji(undefined, groupName, comps[0]?.country_code ?? null)}</span>
                            <span>{groupName}</span>
                          </div>
                          <div className="text-[11px] text-white/70">
                            {comps.length} {tr("leagues").toLowerCase()}
                            {featuredCount ? ` • ${featuredCount} ${tr("featured")}` : ""}
                          </div>
                        </div>
                        <span className="text-xs text-white/70">{open ? "−" : "+"}</span>
                      </button>

                      {open ? (
                        <div className="space-y-2 px-2 pb-2">
                          {comps.map((competition) => {
                            const active = competition.slug === slug;
                            return (
                              <Link
                                key={`${competition.slug}-${competition.id}`}
                                href={`/leagues/${competition.slug}?date=${refISO}`}
                                className={`block rounded-xl border px-3 py-2 transition ${
                                  active
                                    ? "border-emerald-300/35 bg-emerald-300/15"
                                    : "border-white/15 bg-black/20 hover:bg-black/30"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="shrink-0 text-base">{competitionFlag(competition)}</span>
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
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
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
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            onClick={() => moveRound(-1)}
                            disabled={!canGoPrevRound}
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-xl font-black transition ${
                              canGoPrevRound
                                ? "border-emerald-300/30 bg-emerald-400/25 text-white hover:bg-emerald-400/35"
                                : "border-white/10 bg-white/5 text-white/30"
                            }`}
                          >
                            ←
                          </button>

                          <div
                            ref={roundsScrollRef}
                            className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]"
                          >
                            {roundMeta.map((item) => {
                              const active = item.round === selectedRound;
                              return (
                                <button
                                  key={item.round}
                                  ref={active ? activeRoundRef : null}
                                  onClick={() => setRound(item.round)}
                                  className={`shrink-0 rounded-2xl border px-4 py-2 text-center transition ${
                                    active
                                      ? "border-emerald-300/35 bg-emerald-400/25 text-white"
                                      : "border-white/15 bg-white/10 text-white/85 hover:bg-white/15"
                                  }`}
                                >
                                  <div className="text-xl font-black leading-none">{item.round}</div>
                                  <div className="mt-1 text-[11px] font-semibold text-white/70">{formatRoundDate(item.first_date)}</div>
                                </button>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => moveRound(1)}
                            disabled={!canGoNextRound}
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-xl font-black transition ${
                              canGoNextRound
                                ? "border-emerald-300/30 bg-emerald-400/25 text-white hover:bg-emerald-400/35"
                                : "border-white/10 bg-white/5 text-white/30"
                            }`}
                          >
                            →
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-white">{tr("matches")}</h2>
                      <p className="text-sm text-white/80">
                        {tr("seasonLabel")}: <span className="font-semibold text-white">{seasonName}</span> • {tr("round")}:{" "}
                        <span className="font-semibold text-white">{selectedRound ?? "—"}</span> • {tr("tz")}:{" "}
                        <span className="font-semibold text-white">{timeZone}</span>
                      </p>
                    </div>

                    {data.matches.length === 0 ? (
                      <div className="rounded-2xl border border-white/15 bg-black/20 p-8 text-center text-white/80 backdrop-blur">
                        {selectedRound == null ? tr("noMatchesSeason") : tr("noMatchesRound")}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 backdrop-blur">
                        <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 text-base">{competitionFlag(data.competition)}</span>
                            <LeagueLogo slug={data.competition.slug} alt={data.competition.name} />
                            <div className="truncate font-semibold text-white">{data.competition.name}</div>
                          </div>
                          <div className="text-sm text-white/70">{data.competition.region}</div>
                        </div>

                        <div className="divide-y divide-white/10">
                          {data.matches.map((match) => {
                            const timeLabel =
                              match.status === "LIVE"
                                ? `${tr("statusLive")} ${match.minute ?? ""}${match.minute ? "'" : ""}`.trim()
                                : match.status === "FT"
                                  ? tr("statusFt")
                                  : formatKickoffTZ(match.match_date, match.kickoff_time, timeZone) ?? tr("tbd");

                            return (
                              <div
                                key={match.id}
                                className={`flex items-center gap-4 px-4 py-3 ${
                                  match.status === "LIVE" ? "bg-red-400/10 ring-1 ring-red-300/40" : "hover:bg-white/5"
                                }`}
                              >
                                <div className="w-32 shrink-0">
                                  <div className="text-lg font-extrabold tracking-tight text-white">{timeLabel}</div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white/90">
                                      {match.status === "FT"
                                        ? tr("statusFt")
                                        : match.status === "LIVE"
                                          ? tr("statusLive")
                                          : tr("statusPre")}
                                    </span>
                                    <span className="text-xs text-white/70">{niceDate(match.match_date)}</span>
                                  </div>
                                </div>

                                <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                                  <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                                    <span className="flex min-w-0 items-center gap-2">
                                      <TeamLogo slug={match.home_team?.slug} alt={match.home_team?.name || tr("teamHomeFallback")} />
                                      <span className="truncate">{match.home_team?.name || tr("tbd")}</span>
                                    </span>
                                    <span className="font-extrabold tabular-nums text-white">
                                      {match.status === "NS" ? "—" : match.home_score ?? "-"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
                                    <span className="flex min-w-0 items-center gap-2">
                                      <TeamLogo slug={match.away_team?.slug} alt={match.away_team?.name || tr("teamAwayFallback")} />
                                      <span className="truncate">{match.away_team?.name || tr("tbd")}</span>
                                    </span>
                                    <span className="font-extrabold tabular-nums text-white">
                                      {match.status === "NS" ? "—" : match.away_score ?? "-"}
                                    </span>
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
                                  <span className="flex min-w-0 items-center gap-2">
                                    <TeamLogo slug={row.teamSlug} alt={row.team} />
                                    <span className="truncate font-semibold text-white">{row.team}</span>
                                  </span>
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

                    <AdSlot
                      slot={leagueBannerSlot}
                      format="horizontal"
                      minHeight={140}
                      fallbackTitle="Banner premium RugbyNow"
                      fallbackSubtitle="Espacio horizontal para anuncios debajo de la tabla."
                      className="hidden min-h-[140px] w-full lg:block"
                    />
                  </section>
                </div>
              </>
            )}
          </div>
        </main>

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

        <footer className={`w-full px-4 py-8 text-xs text-white/70 sm:px-6 xl:pr-[348px] ${sidebarOpen ? "xl:pl-[412px]" : "xl:pl-[92px]"}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logohorizontal.png"
                alt="RugbyNow"
                width={150}
                height={28}
                className="h-auto w-[120px] object-contain sm:w-[150px]"
              />
              <div>
                {tr("builtBy")} <span className="font-semibold text-white">Vito Loprestti</span> • TZ:{" "}
                <span className="font-semibold text-white">{timeZone}</span>
              </div>
            </div>
            <div className="opacity-90">
              {tr("contact")}:{" "}
              <a className="underline" href="mailto:lopresttivito@gmail.com">
                lopresttivito@gmail.com
              </a>
              <span className="mx-2">•</span>
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
