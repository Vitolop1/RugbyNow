"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/app/components/AppHeader";
import { getLeagueLogo } from "@/lib/assets";

type League = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  group_name?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
};

function LeagueLogo({
  slug,
  alt,
  size = 24,
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
      className="h-6 w-6 object-contain shrink-0 rounded-sm bg-white/5"
      onError={(e) => {
        e.currentTarget.src = fallback;
      }}
    />
  );
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("competitions")
        .select("id, name, slug, region, group_name, sort_order, is_featured")
        .order("is_featured", { ascending: false })
        .order("group_name", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setLeagues([]);
      } else {
        setLeagues((data || []) as League[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const groupedLeagues = useMemo(() => {
    const map = new Map<string, League[]>();

    for (const league of leagues) {
      const group = (league.group_name ?? "").trim() || "Other";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(league);
    }

    const entries = Array.from(map.entries());

    entries.sort((a, b) => {
      const aFeatured = a[1].some((x) => x.is_featured);
      const bFeatured = b[1].some((x) => x.is_featured);
      if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
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
  }, [leagues]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0E4F33] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-green-300/10 blur-3xl" />
      </div>

      <div className="relative">
        <AppHeader subtitle="Pick a competition" />

        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-white">Leagues</h1>
            <p className="text-sm text-white/80 mt-1">
              Pick a competition to see fixtures by date.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-8 text-center text-white/80">
              Loading leagues...
            </div>
          ) : (
            <div className="space-y-6">
              {groupedLeagues.map(([groupName, comps]) => (
                <section key={groupName} className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">{groupName}</h2>
                      <p className="text-xs text-white/70">
                        {comps.length} leagues
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {comps.map((l) => (
                      <Link
                        key={l.id}
                        href={`/leagues/${l.slug}`}
                        className="rounded-2xl border border-white/15 bg-black/20 backdrop-blur p-4 hover:bg-black/30 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <LeagueLogo slug={l.slug} alt={l.name} />
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">{l.name}</div>
                              <div className="text-xs text-white/70 mt-1">
                                {l.region || "—"}
                              </div>
                            </div>
                          </div>

                          {l.is_featured ? (
                            <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-300/25 text-white border border-emerald-200/30 shrink-0">
                              PIN
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}