"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/app/components/AppHeader";

type MatchStatus = "NS" | "LIVE" | "FT";

type Match = {
  timeLabel: string;
  home: string;
  away: string;
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
  round: number | null;
  venue: string | null;

  home_team: { id: number; name: string; slug: string } | null;
  away_team: { id: number; name: string; slug: string } | null;

  season:
    | {
        id: number;
        name: string;
        competition: {
          id: number;
          name: string;
          slug: string;
          region: string | null;
        } | null;
      }
    | null;
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
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}
function niceDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}
function isSameDay(a: Date, b: Date) {
  return toISODateLocal(a) === toISODateLocal(b);
}

function formatKickoffTZ(match_date: string, kickoff_time: string | null, timeZone: string) {
  if (!kickoff_time) return "TBD";
  const t = kickoff_time.length === 5 ? `${kickoff_time}:00` : kickoff_time;
  const dt = new Date(`${match_date}T${t}Z`);
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", timeZone }).format(dt);
}

function displayScore(status: MatchStatus, hs: number | null, as: number | null) {
  // ✅ FIX: if NS always show dash (avoid fake 0-0)
  if (status === "NS") return "—";
  if (hs == null || as == null) return "-";
  return `${hs} - ${as}`;
}

export default function Home() {
  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [tab, setTab] = useState<"ALL" | "LIVE">("ALL");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError] = useState("");

  const [blocks, setBlocks] = useState<LeagueBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const todayLocal = new Date();
  const selectedISO = toISODateLocal(selectedDate);
  const dateQuery = `?date=${selectedISO}`;

  useEffect(() => {
    const saved = localStorage.getItem("tz");
    if (saved) setTimeZone(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("tz", timeZone);
  }, [timeZone]);

  useEffect(() => {
    const loadComps = async () => {
      setCompLoading(true);
      setCompError("");

      const { data, error } = await supabase
        .from("competitions")
        .select("id, name, slug, region, country_code, category, group_name, sort_order, is_featured")
        .order("is_featured", { ascending: false })
        .order("group_name", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        setCompetitions([]);
        setCompError(error.message ?? "Unknown competitions error");
        setCompLoading(false);
        return;
      }

      setCompetitions((data || []) as Competition[]);
      setCompLoading(false);
    };

    loadComps();
  }, []);

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
      const group = (c.group_name ?? "").trim() || "Other";
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
    let cancelled = false;
    let timer: any = null;

    const loadMatches = async () => {
      setLoading(true);
      setLoadError("");

      const dayISO = toISODateLocal(selectedDate);

      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          id,
          match_date,
          kickoff_time,
          status,
          minute,
          home_score,
          away_score,
          round,
          venue,
          home_team:home_team_id ( id, name, slug ),
          away_team:away_team_id ( id, name, slug ),
          season:season_id (
            id,
            name,
            competition:competition_id ( id, name, slug, region )
          )
        `
        )
        .eq("match_date", dayISO)
        .order("kickoff_time", { ascending: true });

      if (cancelled) return;

      if (error) {
        setBlocks([]);
        setLoadError(error.message ?? "Unknown matches error");
        setLoading(false);
        timer = setTimeout(loadMatches, 60_000);
        return;
      }

      const rows = (data || []) as unknown as DbMatchRow[];
      const map = new Map<string, LeagueBlock>();
      let hasLive = false;

      for (const r of rows) {
        if (r.status === "LIVE") hasLive = true;

        const compName = r.season?.competition?.name ?? "Unknown Competition";
        const compSlug = r.season?.competition?.slug ?? "unknown";
        const region = r.season?.competition?.region ?? "";

        const kickoffLabel =
          r.status === "LIVE"
            ? `LIVE ${r.minute ?? ""}${r.minute ? "'" : ""}`.trim()
            : r.status === "FT"
            ? "FT"
            : formatKickoffTZ(r.match_date, r.kickoff_time, timeZone);

        // ✅ FIX: for NS, force null scores even if DB has 0 defaults
        const hs = r.status === "NS" ? null : r.home_score;
        const as = r.status === "NS" ? null : r.away_score;

        const match: Match = {
          timeLabel: kickoffLabel,
          home: r.home_team?.name ?? "TBD",
          away: r.away_team?.name ?? "TBD",
          hs,
          as,
          status: r.status,
        };

        if (!map.has(compSlug)) map.set(compSlug, { league: compName, region, slug: compSlug, matches: [] });
        map.get(compSlug)!.matches.push(match);
      }

      setBlocks(Array.from(map.values()));
      setLoading(false);

      const nextMs = hasLive ? 10_000 : 60_000;
      timer = setTimeout(loadMatches, nextMs);
    };

    loadMatches();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedDate, timeZone]);

  const filteredBlocks = useMemo(() => {
    if (tab !== "LIVE") return blocks;
    return blocks
      .map((b) => ({ ...b, matches: b.matches.filter((m) => m.status === "LIVE") }))
      .filter((b) => b.matches.length > 0);
  }, [blocks, tab]);

  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-green-300 via-green-600 to-green-400 dark:bg-black dark:from-black dark:via-black dark:to-black text-neutral-900 dark:text-white">
      <AppHeader showTabs tab={tab} setTab={setTab} />

      <main className="mx-auto max-w-[1280px] px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <aside className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-4 h-fit dark:border-white/10 dark:bg-neutral-950 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-neutral-700 dark:text-white/80">Fechas</div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  className="px-2 py-1 rounded-lg text-xs border bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                >
                  ←
                </button>

                <button
                  onClick={() => setSelectedDate(new Date())}
                  className="px-2 py-1 rounded-lg text-xs border bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                >
                  Today
                </button>

                <button
                  onClick={() => setSelectedDate((d) => addDays(d, +1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  NEXT →
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                type="date"
                value={selectedISO}
                onChange={(e) => setSelectedDate(fromISODateLocal(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-sm border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10"
              />
              <span
                className={`px-2 py-1 rounded-full text-[11px] border whitespace-nowrap ${
                  isSameDay(selectedDate, todayLocal)
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white/70 border-neutral-200 text-neutral-700 dark:bg-neutral-900 dark:border-white/10 dark:text-white/70"
                }`}
              >
                {isSameDay(selectedDate, todayLocal) ? "HOY" : "OTRO"}
              </span>
            </div>

            <div className="text-xs text-neutral-700 dark:text-white/60">
              Seleccionada: <span className="font-semibold">{niceDate(selectedDate)}</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2 text-neutral-700 dark:text-white/80">Ligas</div>

            {compLoading ? (
              <div className="text-xs text-neutral-700 dark:text-white/60">Cargando ligas...</div>
            ) : compError ? (
              <div className="text-xs text-red-700 dark:text-red-300">{compError}</div>
            ) : (
              <div className="space-y-3">
                {groupedCompetitions.map(([groupName, comps]) => {
                  const open = openGroups[groupName] ?? false;
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
                              className="block w-full text-left px-3 py-2 rounded-xl border transition bg-white border-neutral-200 hover:bg-white/90 dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium truncate">{c.name}</div>
                                {c.is_featured ? (
                                  <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-600 text-white">
                                    PIN
                                  </span>
                                ) : null}
                              </div>
                              {c.region ? <div className="text-xs opacity-70">{c.region}</div> : null}
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
            <h2 className="text-xl font-bold">Matches</h2>
            <p className="text-sm text-neutral-700 dark:text-white/60">
              Date: <span className="font-semibold">{niceDate(selectedDate)}</span> •{" "}
              {tab === "LIVE" ? "Live only" : "All matches"} • TZ:{" "}
              <span className="font-semibold">{timeZone}</span>
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              Loading matches...
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-300 bg-white/70 backdrop-blur p-6 text-neutral-800 dark:border-red-500/40 dark:bg-neutral-950 dark:text-white/80">
              <div className="font-bold">Supabase error</div>
              <div className="mt-2 text-sm opacity-80">{loadError}</div>
            </div>
          ) : filteredBlocks.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur p-8 text-center text-neutral-700 dark:border-white/10 dark:bg-neutral-950 dark:text-white/70">
              No matches for this date (but sidebar stays 😉)
            </div>
          ) : (
            filteredBlocks.map((block) => (
              <div
                key={block.slug}
                className="rounded-2xl border border-neutral-200 bg-white/70 backdrop-blur overflow-hidden dark:border-white/10 dark:bg-neutral-950"
              >
                <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-200 dark:border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <div className="font-semibold truncate">{block.league}</div>
                  </div>
                  <div className="text-sm text-neutral-700 dark:text-white/60">{block.region}</div>
                </div>

                <div className="divide-y divide-neutral-200 dark:divide-white/10">
                  {block.matches.map((m, idx) => (
                    <div
                      key={`${block.slug}-${idx}-${m.timeLabel}-${m.home}-${m.away}`}
                      className={`px-4 py-3 flex items-center gap-4 transition ${
                        m.status === "LIVE"
                          ? "ring-1 ring-red-500/40 bg-red-50/60 dark:bg-red-500/10"
                          : "hover:bg-white/60 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="w-32 shrink-0">
                        <div className="text-lg font-extrabold tracking-tight text-neutral-900 dark:text-white">
                          {m.timeLabel}
                        </div>
                        <div className="mt-1">
                          <StatusBadge status={m.status} />
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                        <div className="flex items-center justify-between rounded-xl bg-white/90 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
                          <span className="font-medium truncate">{m.home}</span>
                          <span className="font-extrabold tabular-nums">
                            {m.status === "NS" ? "—" : m.hs ?? "-"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-white/90 border border-neutral-200 px-3 py-2 dark:bg-neutral-900 dark:border-white/10">
                          <span className="font-medium truncate">{m.away}</span>
                          <span className="font-extrabold tabular-nums">
                            {m.status === "NS" ? "—" : m.as ?? "-"}
                          </span>
                        </div>
                      </div>

                      <div className="hidden md:block w-36 text-right text-xs text-neutral-700 dark:text-white/50 shrink-0">
                        {m.status === "LIVE" ? "Live action" : m.status === "FT" ? "Final" : "Upcoming"}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 border-t border-neutral-200 dark:border-white/10 flex justify-end">
                  <Link
                    href={`/leagues/${block.slug}${dateQuery}`}
                    className="text-xs font-extrabold px-3 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Open league →
                  </Link>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 text-xs text-neutral-800 dark:text-white/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            RugbyNow • Built by <span className="font-semibold">Vito Loprestti</span> • TZ:{" "}
            <span className="font-semibold">{timeZone}</span>
          </div>
          <div className="opacity-90">
            Contact:{" "}
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
  );
}