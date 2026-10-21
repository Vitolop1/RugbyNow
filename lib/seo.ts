import type { Metadata } from "next";
import bundledSnapshotJson from "@/data/supabase-snapshot.json";
import { getCompetitionProfile } from "@/lib/competitionProfiles";
import { getSiteUrl } from "@/lib/site";
import { getTeamProfile } from "@/lib/teamProfiles";

type SnapshotCompetition = {
  name: string;
  slug: string;
  region?: string | null;
  country_code?: string | null;
};

type SnapshotTeam = {
  name: string;
  slug?: string | null;
  country?: string | null;
  country_code?: string | null;
};

type SnapshotPayload = {
  competitions?: SnapshotCompetition[];
  teams?: SnapshotTeam[];
};

function getSnapshot(): SnapshotPayload {
  return (bundledSnapshotJson as SnapshotPayload) ?? {};
}

function siteImage() {
  return "/opengraph-image";
}

export function buildStaticMetadata({
  title,
  description,
  path,
  keywords = [],
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}${path}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "RugbyNow",
      images: [
        {
          url: siteImage(),
          alt: "RugbyNow",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteImage()],
    },
  };
}

export function buildLeagueMetadata(slug: string): Metadata {
  const competition = getSnapshot().competitions?.find((item) => item.slug === slug) ?? null;
  const profile = getCompetitionProfile(slug, {
    name: competition?.name,
    country: competition?.country_code ?? undefined,
    region: competition?.region ?? undefined,
  });
  const name = competition?.name ?? profile.slug;
  const region = profile.country || profile.region || competition?.region || "international rugby";
  const priority:Record<string,{title:string;description:string}>={
    'ar-urba-top14':{title:'URBA Top 14: resultados, tabla de posiciones y fixture',description:'Consultá los resultados del rugby de Buenos Aires, la tabla oficial de URBA Top 14 y el calendario por temporada. Accedé a clubes y últimos encuentros.'},
    'fr-pro-d2':{title:'Pro D2: résultats, classement et calendrier',description:'Résultats et classement officiel de Pro D2, calendrier par saison, effectifs des clubs et chaînes confirmées pour chaque match en France.'},
    'fr-top14':{title:'Top 14 France: résultats, classement et calendrier',description:'Consultez les résultats du Top 14, le classement officiel, les prochains matchs et les effectifs des clubs. Dates à confirmer signalées dans le calendrier.'},
  };
  const title = priority[slug]?.title||`${name} Results, Fixtures and Standings`;
  const description = priority[slug]?.description||`${name} results, fixtures and available standings on RugbyNOW. Browse seasons, clubs and match details from ${region}; coverage varies by competition.`;

  return buildStaticMetadata({
    title,
    description,
    path: `/leagues/${slug}`,
    keywords: [
      name,
      `${name} results`,
      `${name} standings`,
      `${name} fixtures`,
      `${name} table`,
      "rugby standings",
      "rugby fixtures",
      "rugby results",
    ],
  });
}

export function buildTeamMetadata(slug: string): Metadata {
  const team = getSnapshot().teams?.find((item) => item.slug === slug) ?? null;
  const profile = getTeamProfile(slug, team?.name);
  const name = team?.name ?? profile.displayName ?? slug;
  const countryOrCity = profile.city || profile.country || team?.country || "rugby";
  const title = slug==="argentina"?"Los Pumas: próximos partidos, resultados y selección argentina":`${name} Rugby Results and Fixtures`;
  const description = slug==="argentina"?"Próximos partidos de Los Pumas, resultados de Argentina y competiciones. Elegí XV o Seven y consultá horarios en tu zona y transmisiones confirmadas por país.":`${name} rugby results, upcoming fixtures and available club information on RugbyNOW. Follow ${name} from ${countryOrCity}; squad coverage is identified by season and source.`;

  return buildStaticMetadata({
    title,
    description,
    path: `/teams/${slug}`,
    keywords: [
      name,
      `${name} rugby`,
      `${name} squad`,
      `${name} results`,
      `${name} fixtures`,
      "rugby teams",
    ],
  });
}
