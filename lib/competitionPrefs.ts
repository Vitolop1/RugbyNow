export function readSlugList(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function writeSlugList(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(values)).sort()));
}

export function toggleSlug(values: string[], slug: string) {
  return values.includes(slug) ? values.filter((value) => value !== slug) : [...values, slug];
}

type CompetitionLike = {
  slug: string;
  name?: string | null;
  region?: string | null;
  country_code?: string | null;
  group_name?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
};

export type CompetitionCountryKey =
  | "argentina"
  | "england"
  | "france"
  | "italy"
  | "spain"
  | "germany"
  | "portugal"
  | "brazil"
  | "uruguay"
  | "paraguay"
  | "colombia"
  | "chile"
  | "mexico"
  | "usa";

export type CompetitionNavigationBadgeKey = CompetitionCountryKey | "featured" | "franchises" | "selections" | "seven" | "other";

export type CompetitionNavigationSection<T extends CompetitionLike> = {
  key: string;
  label: string;
  badgeKey: CompetitionNavigationBadgeKey;
  competitions: T[];
};

export type CompetitionNavigationLabels = {
  featured: string;
  franchises: string;
  selections: string;
  seven: string;
  other: string;
  argentina: string;
  england: string;
  france: string;
  italy: string;
  spain: string;
  germany: string;
  portugal: string;
  brazil: string;
  uruguay: string;
  paraguay: string;
  colombia: string;
  chile: string;
  mexico: string;
  usa: string;
};

const FEATURED_COMPETITION_SLUGS = new Set([
  "int-world-cup",
  "int-six-nations",
  "eu-champions-cup",
  "int-super-rugby-pacific",
  "sra",
]);

const FRANCHISE_COMPETITION_SLUGS = new Set([
  "sra",
  "int-super-rugby-pacific",
  "int-united-rugby-championship",
]);

const COUNTRY_ORDER: CompetitionCountryKey[] = [
  "argentina",
  "england",
  "spain",
  "italy",
  "germany",
  "portugal",
  "france",
  "brazil",
  "uruguay",
  "paraguay",
  "colombia",
  "chile",
  "mexico",
  "usa",
];

function normalizeText(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

export function isArgentinaCompetition(slug: string) {
  return slug.startsWith("ar-");
}

export function isEuropeCompetition(slug: string) {
  return new Set(["en-premiership-rugby", "it-serie-a-elite", "fr-top14"]).has(slug);
}

export function isSevenCompetition(slug: string) {
  return slug.startsWith("svns-") || slug.includes("sevens") || slug.includes("7s");
}

export function isSouthAmericaCompetition(slug: string) {
  return new Set(["sra"]).has(slug);
}

export function isInternationalSelectionsCompetition(slug: string) {
  return new Set(["int-six-nations", "int-world-cup", "int-nations-championship"]).has(slug);
}

export function isInternationalClubsCompetition(slug: string) {
  return new Set(["eu-champions-cup", "int-super-rugby-pacific", "int-united-rugby-championship"]).has(slug);
}

export function isFeaturedCompetition(competition: CompetitionLike) {
  return !!competition.is_featured || FEATURED_COMPETITION_SLUGS.has(competition.slug.toLowerCase());
}

export function isFranchiseCompetition(competition: CompetitionLike) {
  return FRANCHISE_COMPETITION_SLUGS.has(competition.slug.toLowerCase());
}

export function getCompetitionCountryKey(competition: CompetitionLike): CompetitionCountryKey | null {
  const slug = competition.slug.toLowerCase();
  const region = normalizeText(competition.region);
  const groupName = normalizeText(competition.group_name);
  const code = normalizeText(competition.country_code);
  const source = `${slug} ${region} ${groupName} ${code}`;

  if (slug.startsWith("ar-") || matchesAny(source, ["argentina", " ar "]) || code === "ar") return "argentina";
  if (slug.startsWith("en-") || matchesAny(source, ["england", "inglaterra"]) || code === "en" || code === "gb") return "england";
  if (slug.startsWith("fr-") || matchesAny(source, ["france", "francia"]) || code === "fr") return "france";
  if (slug.startsWith("it-") || matchesAny(source, ["italy", "italia"]) || code === "it") return "italy";
  if (matchesAny(source, ["spain", "espana"]) || code === "es") return "spain";
  if (matchesAny(source, ["germany", "alemania"]) || code === "de") return "germany";
  if (matchesAny(source, ["portugal"]) || code === "pt") return "portugal";
  if (matchesAny(source, ["brazil", "brasil"]) || code === "br") return "brazil";
  if (matchesAny(source, ["uruguay"]) || code === "uy") return "uruguay";
  if (matchesAny(source, ["paraguay"]) || code === "py") return "paraguay";
  if (matchesAny(source, ["colombia"]) || code === "co") return "colombia";
  if (matchesAny(source, ["chile"]) || code === "cl") return "chile";
  if (matchesAny(source, ["mexico"]) || code === "mx") return "mexico";
  if (slug.startsWith("us-") || matchesAny(source, ["usa", "united states", "eeuu"]) || code === "us") return "usa";

  return null;
}

export function getCompetitionCountryPriority(countryKey: CompetitionCountryKey) {
  const index = COUNTRY_ORDER.indexOf(countryKey);
  return index === -1 ? 999 : index;
}

export function buildCompetitionNavigationSections<T extends CompetitionLike>(
  competitions: T[],
  labels: CompetitionNavigationLabels
) {
  const featured: T[] = [];
  const byCountry = new Map<CompetitionCountryKey, T[]>();
  const franchises: T[] = [];
  const selections: T[] = [];
  const seven: T[] = [];
  const other: T[] = [];

  const sorted = [...competitions].sort((a, b) => {
    const aSort = getCompetitionSortPriority(a);
    const bSort = getCompetitionSortPriority(b);
    if (aSort !== bSort) return aSort - bSort;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  for (const competition of sorted) {
    if (isFeaturedCompetition(competition)) featured.push(competition);

    if (isSevenCompetition(competition.slug.toLowerCase())) {
      seven.push(competition);
      continue;
    }

    if (isInternationalSelectionsCompetition(competition.slug.toLowerCase())) {
      selections.push(competition);
      continue;
    }

    if (isFranchiseCompetition(competition)) {
      franchises.push(competition);
      continue;
    }

    const countryKey = getCompetitionCountryKey(competition);
    if (countryKey) {
      if (!byCountry.has(countryKey)) byCountry.set(countryKey, []);
      byCountry.get(countryKey)!.push(competition);
      continue;
    }

    other.push(competition);
  }

  const countryLabels: Record<CompetitionCountryKey, string> = {
    argentina: labels.argentina,
    england: labels.england,
    france: labels.france,
    italy: labels.italy,
    spain: labels.spain,
    germany: labels.germany,
    portugal: labels.portugal,
    brazil: labels.brazil,
    uruguay: labels.uruguay,
    paraguay: labels.paraguay,
    colombia: labels.colombia,
    chile: labels.chile,
    mexico: labels.mexico,
    usa: labels.usa,
  };

  const sections: CompetitionNavigationSection<T>[] = [];

  if (featured.length) {
    sections.push({
      key: "featured",
      label: labels.featured,
      badgeKey: "featured",
      competitions: featured,
    });
  }

  for (const countryKey of COUNTRY_ORDER) {
    const items = byCountry.get(countryKey);
    if (!items?.length) continue;
    sections.push({
      key: `country:${countryKey}`,
      label: countryLabels[countryKey],
      badgeKey: countryKey,
      competitions: items,
    });
  }

  if (franchises.length) {
    sections.push({
      key: "franchises",
      label: labels.franchises,
      badgeKey: "franchises",
      competitions: franchises,
    });
  }

  if (selections.length) {
    sections.push({
      key: "selections",
      label: labels.selections,
      badgeKey: "selections",
      competitions: selections,
    });
  }

  if (seven.length) {
    sections.push({
      key: "seven",
      label: labels.seven,
      badgeKey: "seven",
      competitions: seven,
    });
  }

  if (other.length) {
    sections.push({
      key: "other",
      label: labels.other,
      badgeKey: "other",
      competitions: other,
    });
  }

  return sections;
}

export function getCompetitionGroupKey(competition: { slug: string; group_name?: string | null; region?: string | null }) {
  const slug = competition.slug.toLowerCase();
  const rawGroup = (competition.group_name ?? "").trim().toLowerCase();
  const rawRegion = (competition.region ?? "").trim().toLowerCase();

  if (isSevenCompetition(slug)) return "seven";
  if (isArgentinaCompetition(slug) || rawGroup === "argentina" || rawRegion === "argentina") return "argentina";
  if (isSouthAmericaCompetition(slug) || rawGroup === "south america" || rawGroup === "sudamerica" || rawRegion === "south america") {
    return "southAmerica";
  }
  if (isEuropeCompetition(slug) || rawGroup === "europe" || rawGroup === "europa") return "europe";
  if (isInternationalSelectionsCompetition(slug)) return "internationalSelections";
  if (isInternationalClubsCompetition(slug)) return "internationalClubs";
  if (rawGroup === "usa" || rawRegion === "usa" || rawRegion === "united states") return "usa";

  return "other";
}

export function getDisplayGroupName(
  competition: { slug: string; group_name?: string | null; region?: string | null },
  labels: {
    argentina: string;
    other: string;
    europe: string;
    seven: string;
    southAmerica: string;
    internationalSelections: string;
    internationalClubs: string;
    usa: string;
  }
) {
  const key = getCompetitionGroupKey(competition);

  if (key === "argentina") return labels.argentina;
  if (key === "southAmerica") return labels.southAmerica;
  if (key === "europe") return labels.europe;
  if (key === "internationalSelections") return labels.internationalSelections;
  if (key === "internationalClubs") return labels.internationalClubs;
  if (key === "seven") return labels.seven;
  if (key === "usa") return labels.usa;

  return (competition.group_name ?? "").trim() || labels.other;
}

export function getCompetitionGroupPriority(competition: { slug: string; group_name?: string | null; region?: string | null }) {
  const key = getCompetitionGroupKey(competition);

  if (key === "argentina") return 10;
  if (key === "southAmerica") return 20;
  if (key === "europe") return 30;
  if (key === "internationalSelections") return 40;
  if (key === "internationalClubs") return 50;
  if (key === "seven") return 60;
  if (key === "usa") return 70;

  return 999;
}

export function getCompetitionSortPriority(competition: {
  slug: string;
  sort_order?: number | null;
  country_code?: string | null;
  region?: string | null;
  name?: string | null;
}) {
  const slug = competition.slug.toLowerCase();
  const region = (competition.region ?? "").toLowerCase();
  const name = (competition.name ?? "").toLowerCase();

  if (slug === "fr-top14") return 1;
  if (slug === "en-premiership-rugby") return 2;
  if (slug === "it-serie-a-elite") return 3;
  if (competition.country_code === "ES" || slug.includes("spain") || region.includes("spain") || name.includes("spain")) return 4;
  if (slug === "int-six-nations") return 5;
  if (slug === "int-world-cup") return 6;
  if (slug === "int-nations-championship") return 7;
  if (slug === "int-super-rugby-pacific") return 8;
  if (slug === "eu-champions-cup") return 9;
  if (slug === "int-united-rugby-championship") return 10;

  return competition.sort_order ?? 9999;
}
