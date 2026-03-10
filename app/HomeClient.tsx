"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { getLeagueLogo, getTeamLogo } from "@/app/lib/assets";
import { usePrefs } from "@/lib/usePrefs";

type MatchStatus = "NS" | "LIVE" | "FT";

type Match = {
  timeLabel: string;
  home: string;
  away: string;
  homeSlug?: string | null;
  awaySlug?: string | null;
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
      className="object-contain shrink-0 rounded-sm bg-white/5"
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
      className="object-contain shrink-0 rounded-sm bg-white/5"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/league-logos/_placeholder.png";
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
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/10 text-white border border-white/15">FT</span>;
  }

  return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/10 text-white/90 border border-white/15">PRE</span>;
}

function TeamName({ name, slug }: { name: string; slug?: string | null }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <TeamLogo slug={slug} alt={name} />
      <span className="truncate">{name}</span>
    </span>
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

function formatKickoffTZ(matchDate: string, kickoffTime: string | null, timeZone: string) {
  if (!kickoffTime) return "TBD";
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(`${matchDate}T${normalized}Z`)
  );
}

function isSameDay(a: Date, b: Date) {
  return toISODateLocal(a) === toISODateLocal(b);
}

function dedupeBlock(block: LeagueBlock) {
  const seen = new Set<string>();
  const matches: Match[] = [];

  for (const match of block.matches) {
    const key = `${block.slug}|${match.timeLabel}|${match.home}|${match.away}|${match.status}|${match.hs ?? ""}|${match.as ?? ""}`;
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
  const { timeZone } = usePrefs();
  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");
  const [selectedISO, setSelectedISO] = useState<string>(getInitialSelectedISO);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError] = useState("");
  const [blocks, setBlocks] = useState<LeagueBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const lastPushedISO = useRef<string>("");
  const selectedDate = useMemo(() => fromISODateLocal(selectedISO), [selectedISO]);
  const todayLocal = new Date();
  const dateQuery = `?date=${selectedISO}`;

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
        setCompError(payload.error ?? "Unknown competitions error");
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
        setLoadError(payload.error ?? "Unknown matches error");
        setLoading(false);
        timer = setTimeout(loadMatches, 60000);
        return;
      }

      const rows = (payload.matches || []) as DbMatchRow[];
      const byLeague = new Map<string, LeagueBlock>();
      let hasLive = false;

      for (const row of rows) {
        if (row.status === "LIVE") hasLive = true;

        const leagueName = row.season?.competition?.name ?? "Unknown Competition";
        const leagueSlug = row.season?.competition?.slug ?? "unknown";
        const region = row.season?.competition?.region ?? "";

        const timeLabel =
          row.status === "LIVE"
            ? `LIVE ${row.minute ?? ""}${row.minute ? "'" : ""}`.trim()
            : row.status === "FT"
              ? "FT"
              : formatKickoffTZ(row.match_date, row.kickoff_time, timeZone);

        const match: Match = {
          timeLabel,
          home: row.home_team?.name ?? "TBD",
          away: row.away_team?.name ?? "TBD",
          homeSlug: row.home_team?.slug ?? null,
          awaySlug: row.away_team?.slug ?? null,
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
      timer = setTimeout(loadMatches, hasLive ? 10000 : 60000);
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

  const groupedCompetitions = useMemo(() => {
    const groups = new Map<string, Competition[]>();

    for (const competition of dedupedCompetitions) {
      const group = (competition.group_name ?? "").trim() || "Other";
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
  }, [dedupedCompetitions]);

  const filteredBlocks = useMemo(() => {
    if (tab !== "LIVE") return blocks;
    return blocks
      .map((block) => ({ ...block, matches: block.matches.filter((match) => match.status === "LIVE") }))
      .filter((block) => block.matches.length > 0);
  }, [blocks, tab]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0E4F33] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-lime-200/10 blur-3xl" />
      </div>

      <div className="relative">
        <AppHeader showTabs tab={tab} setTab={setTab} />

        <main className="mx-auto max-w-[1280px] px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <aside className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-4 h-fit space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-white/90">Fechas</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedISO(toISODateLocal(addDays(selectedDate, -1)))}
                    className="px-2 py-1 rounded-lg text-xs border border-white/15 bg-white/10 hover:bg-white/15 transition"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setSelectedISO(toISODateLocal(new Date()))}
                    className="px-2 py-1 rounded-lg text-xs border border-white/15 bg-white/10 hover:bg-white/15 transition"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setSelectedISO(toISODateLocal(addDays(selectedDate, 1)))}
                    className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-emerald-300/30 bg-emerald-400/25 hover:bg-emerald-400/35 transition"
                  >
                    NEXT →
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <input
                  type="date"
                  value={selectedISO}
                  onChange={(e) => setSelectedISO(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-white/15 bg-white/10 text-white outline-none"
                />
                <span
                  className={`px-2 py-1 rounded-full text-[11px] border whitespace-nowrap ${
                    isSameDay(selectedDate, todayLocal)
                      ? "bg-emerald-400/30 text-white border-emerald-200/30"
                      : "bg-white/10 border-white/15 text-white/80"
                  }`}
                >
                  {isSameDay(selectedDate, todayLocal) ? "HOY" : "OTRO"}
                </span>
              </div>

              <div className="text-xs text-white/70">
                Seleccionada: <span className="font-semibold text-white">{niceDate(selectedDate)}</span>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2 text-white/90">Ligas</div>

              {compLoading ? (
                <div className="text-xs text-white/70">Cargando ligas...</div>
              ) : compError ? (
                <div className="text-xs text-red-200">{compError}</div>
              ) : (
                <div className="space-y-3">
                  {groupedCompetitions.map(([groupName, comps]) => {
                    const open = openGroups[groupName] ?? false;
                    const featuredCount = comps.filter((competition) => competition.is_featured).length;

                    return (
                      <div key={groupName} className="rounded-xl border border-white/15 bg-white/10 overflow-hidden">
                        <button
                          onClick={() => setOpenGroups((prev) => ({ ...prev, [groupName]: !open }))}
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
                            {comps.map((competition) => (
                              <Link
                                key={`${competition.slug}-${competition.id}`}
                                href={`/leagues/${competition.slug}${dateQuery}`}
                                className="block w-full text-left px-3 py-2 rounded-xl border border-white/15 transition bg-black/20 hover:bg-black/30"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <LeagueLogo slug={competition.slug} alt={competition.name} />
                                    <div className="text-sm font-medium truncate text-white">{competition.name}</div>
                                  </div>
                                  {competition.is_featured ? (
                                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-300/25 text-white border border-emerald-200/30">
                                      PIN
                                    </span>
                                  ) : null}
                                </div>
                                {competition.region ? <div className="text-xs text-white/70 mt-1">{competition.region}</div> : null}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="space-y-4 min-w-0">
            <div>
              <h2 className="text-xl font-bold text-white">Matches</h2>
              <p className="text-sm text-white/80">
                Date: <span className="font-semibold text-white">{niceDate(selectedDate)}</span> •{" "}
                {tab === "LIVE" ? "Live only" : "All matches"} • TZ: <span className="font-semibold text-white">{timeZone}</span>
              </p>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-8 text-center text-white/80">Loading matches...</div>
            ) : loadError ? (
              <div className="rounded-2xl border border-red-200/30 bg-black/20 backdrop-blur p-6 text-white">
                <div className="font-bold">Supabase error</div>
                <div className="mt-2 text-sm text-white/80">{loadError}</div>
              </div>
            ) : filteredBlocks.length === 0 ? (
              <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-8 text-center text-white/80">No matches for this date</div>
            ) : (
              filteredBlocks.map((block) => (
                <div key={block.slug} className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-white/15">
                    <div className="flex items-center gap-2 min-w-0">
                      <LeagueLogo slug={block.slug} alt={block.league} />
                      <div className="font-semibold truncate text-white">{block.league}</div>
                    </div>
                    <div className="text-sm text-white/70">{block.region}</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {block.matches.map((match, index) => (
                      <div
                        key={`${block.slug}-${index}-${match.timeLabel}-${match.home}-${match.away}`}
                        className={`px-4 py-3 flex items-center gap-4 transition ${
                          match.status === "LIVE" ? "ring-1 ring-red-300/40 bg-red-400/10" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="w-32 shrink-0">
                          <div className="text-lg font-extrabold tracking-tight text-white">{match.timeLabel}</div>
                          <div className="mt-1">
                            <StatusBadge status={match.status} />
                          </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                          <div className="flex items-center justify-between rounded-xl bg-white/10 border border-white/15 px-3 py-2">
                            <TeamName name={match.home} slug={match.homeSlug} />
                            <span className="font-extrabold tabular-nums text-white">{match.status === "NS" ? "—" : match.hs ?? "-"}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-white/10 border border-white/15 px-3 py-2">
                            <TeamName name={match.away} slug={match.awaySlug} />
                            <span className="font-extrabold tabular-nums text-white">{match.status === "NS" ? "—" : match.as ?? "-"}</span>
                          </div>
                        </div>

                        <div className="hidden md:block w-36 text-right text-xs text-white/70 shrink-0">
                          {match.status === "LIVE" ? "Live action" : match.status === "FT" ? "Final" : "Upcoming"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-white/15 flex justify-end">
                    <Link
                      href={`/leagues/${block.slug}${dateQuery}`}
                      className="text-xs font-extrabold px-3 py-2 rounded-full bg-emerald-300/25 text-white border border-emerald-200/30 hover:bg-emerald-300/35 transition"
                    >
                      Open league →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </section>
        </main>

        <footer className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 text-xs text-white/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              RugbyNow • Built by <span className="font-semibold text-white">Vito Loprestti</span> • TZ: <span className="font-semibold text-white">{timeZone}</span>
            </div>
            <div className="opacity-90">
              Contact: <a className="underline" href="mailto:lopresttivito@gmail.com">lopresttivito@gmail.com</a>
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
