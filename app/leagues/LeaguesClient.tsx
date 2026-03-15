"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import CompetitionSectionBadge from "@/app/components/CompetitionSectionBadge";
import { getLeagueLogo } from "@/lib/assets";
import {
  buildCompetitionNavigationSections,
  getSeasonSortKey,
} from "@/lib/competitionPrefs";
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

export default function LeaguesClient() {
  const { lang } = usePrefs();
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
      if (
        !previous ||
        getSeasonSortKey(season.name) > getSeasonSortKey(previous.name) ||
        (getSeasonSortKey(season.name) === getSeasonSortKey(previous.name) &&
          season.name.localeCompare(previous.name) > 0)
      ) {
        map.set(season.competition_id, season);
      }
    }

    return map;
  }, [seasons]);

  const sections = useMemo(
    () =>
      buildCompetitionNavigationSections(leagues, {
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
      }),
    [
      argentinaGroupLabel,
      brazilGroupLabel,
      chileGroupLabel,
      colombiaGroupLabel,
      europeGroupLabel,
      englandGroupLabel,
      featuredGroupLabel,
      franchisesGroupLabel,
      franceGroupLabel,
      germanyGroupLabel,
      italyGroupLabel,
      leagues,
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
            {sections.map((section) => (
              <section key={section.key}>
                <div className="mb-3 flex items-center gap-2">
                  <CompetitionSectionBadge badgeKey={section.badgeKey} alt={section.label} size={20} />
                  <h2 className="text-lg font-bold">{section.label}</h2>
                  <span className="text-xs text-white/60">
                    {section.competitions.length} {tr("leagues").toLowerCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {section.competitions.map((league) => {
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
                              <div className="mt-1 text-xs text-white/75">{league.region || "-"}</div>
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
