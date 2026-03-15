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
  return "/logo.png";
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
  const title = `${name} Results, Fixtures, Standings and Table`;
  const description = `${name} results, fixtures, live scores, standings and table updates on RugbyNow. Follow ${name} coverage, match context and season updates from ${region}.`;

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
  const title = `${name} Rugby Results, Fixtures and Squad`;
  const description = `${name} rugby profile on RugbyNow with results, fixtures, recent matches, squad context and club information. Follow ${name} from ${countryOrCity}.`;

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
