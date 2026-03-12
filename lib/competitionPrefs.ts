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
