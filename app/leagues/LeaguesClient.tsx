"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PortalShell from "@/app/components/PortalShell";
import {usePersonalization} from "@/lib/usePersonalization";
import {toggleSlug} from "@/lib/competitionPrefs";
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
  const {prefs,update}=usePersonalization();
  const [query,setQuery]=useState("");
  const [error,setError]=useState(false);
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
  const [populatedSeasonIds,setPopulatedSeasonIds]=useState<number[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      try {
      const response = await fetch("/api/leagues", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        setError(true);
        setLeagues([]);
        setSeasons([]);
      } else {
        setLeagues((payload.competitions || []) as League[]);
        setSeasons((payload.seasons || []) as Season[]);
        setPopulatedSeasonIds(payload.populatedSeasonIds || []);
      }

      }catch{setError(true);}
      setLoading(false);
    };

    load();
  }, []);

  const latestSeasonByCompetition = useMemo(() => {
    const map = new Map<number, Season>();

    for (const season of seasons) {
      if(populatedSeasonIds.length && !populatedSeasonIds.includes(season.id))continue;
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
  }, [seasons,populatedSeasonIds]);

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

  return <PortalShell title={tr("pickCompetition")} subtitle={tr("pickCompetitionSub")}>
    <label className="rn-search"><span>{lang==="es"?"Buscar competición":"Search competitions"}</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    {error&&<p role="alert">{lang==="es"?"No se pudo cargar el catálogo. Recargá para reintentar.":"Could not load the directory. Reload to retry."}</p>}
    {loading?<p>{tr("loading")}</p>:sections.map(section=>{const visible=section.competitions.filter(l=>l.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));return visible.length?<section className="rn-panel" key={section.key}>
      <h2><CompetitionSectionBadge badgeKey={section.badgeKey} alt={section.label} size={20}/>{section.label}<small>{visible.length}</small></h2>
      {visible.map(league=><div className="rn-directory-row" key={league.id}><button aria-label={`${prefs.leagues.includes(league.slug)?"Unfollow":"Follow"}: ${league.name}`} aria-pressed={prefs.leagues.includes(league.slug)} className={prefs.leagues.includes(league.slug)?"rn-selected":""} onClick={()=>update({leagues:toggleSlug(prefs.leagues,league.slug)})}>{prefs.leagues.includes(league.slug)?"★":"☆"}</button><Link href={`/leagues/${league.slug}`} className="rn-directory-link"><LeagueLogo slug={league.slug} alt=""/><strong>{league.name}</strong><span>{league.region}</span><small>{latestSeasonByCompetition.get(league.id)?.name || "—"}</small><b>›</b></Link></div>)}
    </section>:null;})}
  </PortalShell>;
}
