"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/app/components/AppHeader";
import { getLeagueLogo } from "@/lib/assets";
import { getCompetitionEmoji } from "@/lib/competitionMeta";

type League = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  country_code?: string | null;
  group_name?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
};

type Season = {
  id: number;
  name: string;
  competition_id: number;
};

function LeagueLogo({
  slug,
  alt,
  size = 22,
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
      className="h-[22px] w-[22px] object-contain shrink-0 rounded-sm bg-white/5"
      onError={(e) => {
        e.currentTarget.src = fallback;
      }}
    />
  );
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: comps, error: compsError } = await supabase
        .from("competitions")
        .select("id, name, slug, region, country_code, group_name, sort_order, is_featured")
        .order("group_name", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      const { data: ssn, error: seasonsError } = await supabase
        .from("seasons")
        .select("id, name, competition_id");

      if (compsError || seasonsError) {
        console.error(compsError || seasonsError);
        setLeagues([]);
        setSeasons([]);
      } else {
        setLeagues((comps || []) as League[]);
        setSeasons((ssn || []) as Season[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const latestSeasonByCompetition = useMemo(() => {
    const map = new Map<number, Season>();

    for (const s of seasons) {
      const prev = map.get(s.competition_id);
      if (!prev) {
        map.set(s.competition_id, s);
        continue;
      }

      if (String(s.name) > String(prev.name)) {
        map.set(s.competition_id, s);
      }
    }

    return map;
  }, [seasons]);

  const grouped = useMemo(() => {
    const map = new Map<string, League[]>();

    for (const l of leagues) {
      const g = (l.group_name || "Other").trim();
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(l);
    }

    const entries = Array.from(map.entries());

    entries.sort((a, b) => {
      const order = ["International", "Argentina", "USA", "France", "Italy", "Other"];
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }
      return a[0].localeCompare(b[0]);
    });

    for (const [, arr] of entries) {
      arr.sort((a, b) => {
        const as = a.sort_order ?? 9999;
        const bs = b.sort_order ?? 9999;
        if (as !== bs) return as - bs;
        return a.name.localeCompare(b.name);
      });
    }

    return entries;
  }, [leagues]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0E4F33] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-green-300/10 blur-3xl" />
      </div>

      <AppHeader subtitle="Pick a competition" />

      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">Leagues</h1>
        <p className="text-sm text-white/80 mt-1">Pick a competition to see fixtures by date.</p>

        {loading ? (
          <div className="mt-6 text-white/80">Loading...</div>
        ) : (
          <div className="mt-6 space-y-6">
            {grouped.map(([groupName, items]) => (
              <section key={groupName}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">
                    {groupName === "International"
                      ? "🌍"
                      : groupName === "Argentina"
                      ? "🇦🇷"
                      : groupName === "USA"
                      ? "🇺🇸"
                      : groupName === "France"
                      ? "🇫🇷"
                      : groupName === "Italy"
                      ? "🇮🇹"
                      : "🏉"}
                  </span>
                  <h2 className="text-lg font-bold">{groupName}</h2>
                  <span className="text-xs text-white/60">{items.length} leagues</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((l) => {
                    const season = latestSeasonByCompetition.get(l.id);

                    return (
                      <Link
                        key={l.id}
                        href={`/leagues/${l.slug}`}
                        className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-4 hover:bg-white/15 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <LeagueLogo slug={l.slug} alt={l.name} />
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{l.name}</div>
                              <div className="text-xs text-white/75 mt-1">
                                {getCompetitionEmoji(l.slug, l.group_name, l.country_code)} {l.region || "—"}
                              </div>
                            </div>
                          </div>

                          {l.is_featured ? (
                            <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-300/25 text-white border border-emerald-200/30">
                              PIN
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 text-xs text-white/70">
                          Season: <span className="font-semibold text-white">{season?.name || "—"}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}