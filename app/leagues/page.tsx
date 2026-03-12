"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import { getLeagueLogo } from "@/lib/assets";
import { getCompetitionEmoji } from "@/lib/competitionMeta";
import { getCompetitionGroupPriority, getCompetitionSortPriority, getDisplayGroupName } from "@/lib/competitionPrefs";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

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

function LeagueLogo({ slug, alt, size = 22 }: { slug?: string | null; alt: string; size?: number }) {
  return (
    <img
      src={getLeagueLogo(slug)}
      alt={alt}
      width={size}
      height={size}
      className="h-[22px] w-[22px] shrink-0 rounded-sm bg-white/5 object-contain"
      onError={(e) => {
        e.currentTarget.src = "/league-logos/_placeholder.png";
      }}
    />
  );
}

export default function LeaguesPage() {
  const { lang } = usePrefs();
  const tr = (key: string) => t(lang, key);
  const otherGroupLabel = tr("groupsOther");
  const europeGroupLabel = tr("groupsEurope");
  const sevenGroupLabel = tr("groupsSeven");
  const southAmericaGroupLabel = tr("groupsSouthAmerica");
  const [leagues, setLeagues] = useState<League[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const response = await fetch("/api/leagues", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        console.error(payload.error);
        setLeagues([]);
        setSeasons([]);
      } else {
        setLeagues((payload.competitions || []) as League[]);
        setSeasons((payload.seasons || []) as Season[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  const latestSeasonByCompetition = useMemo(() => {
    const map = new Map<number, Season>();

    for (const season of seasons) {
      const previous = map.get(season.competition_id);
      if (!previous || String(season.name) > String(previous.name)) map.set(season.competition_id, season);
    }

    return map;
  }, [seasons]);

  const grouped = useMemo(() => {
    const map = new Map<string, League[]>();

    for (const league of leagues) {
      const group = getDisplayGroupName(league, {
        other: otherGroupLabel,
        europe: europeGroupLabel,
        seven: sevenGroupLabel,
        southAmerica: southAmericaGroupLabel,
      });
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(league);
    }

    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      const aPriority = getCompetitionGroupPriority(a[1][0]);
      const bPriority = getCompetitionGroupPriority(b[1][0]);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a[0].localeCompare(b[0]);
    });

    for (const [, items] of entries) {
      items.sort((a, b) => {
        const aSort = getCompetitionSortPriority(a);
        const bSort = getCompetitionSortPriority(b);
        if (aSort !== bSort) return aSort - bSort;
        return a.name.localeCompare(b.name);
      });
    }

    return entries;
  }, [leagues, otherGroupLabel, europeGroupLabel, sevenGroupLabel, southAmericaGroupLabel]);

  return (
    <div className="rn-app-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-green-300/10 blur-3xl" />
      </div>

      <AppHeader subtitle={tr("pickCompetition")} />

      <div className="relative mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">{tr("pickCompetition")}</h1>
        <p className="mt-1 text-sm text-white/80">{tr("pickCompetitionSub")}</p>

        {loading ? (
          <div className="mt-6 text-white/80">{tr("loading")}</div>
        ) : (
          <div className="mt-6 space-y-6">
            {grouped.map(([groupName, items]) => (
              <section key={groupName}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{getCompetitionEmoji(undefined, groupName, items[0]?.country_code ?? null)}</span>
                  <h2 className="text-lg font-bold">{groupName}</h2>
                  <span className="text-xs text-white/60">
                    {items.length} {tr("leagues").toLowerCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((league) => {
                    const season = latestSeasonByCompetition.get(league.id);

                    return (
                      <Link
                        key={league.id}
                        href={`/leagues/${league.slug}`}
                        className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur transition hover:bg-white/15"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <LeagueLogo slug={league.slug} alt={league.name} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{league.name}</div>
                              <div className="mt-1 text-xs text-white/75">
                                {getCompetitionEmoji(league.slug, league.group_name, league.country_code)} {league.region || "-"}
                              </div>
                            </div>
                          </div>

                          {league.is_featured ? (
                            <span className="rounded-full border border-emerald-200/30 bg-emerald-300/25 px-2 py-1 text-[10px] font-extrabold text-white">
                              {tr("pinned")}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-3 text-xs text-white/70">
                          {tr("seasonLabel")}: <span className="font-semibold text-white">{season?.name || "-"}</span>
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
