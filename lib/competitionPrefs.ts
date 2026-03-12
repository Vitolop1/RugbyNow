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

export function isEuropeCompetition(slug: string) {
  return new Set([
    "int-six-nations",
    "eu-champions-cup",
    "en-premiership-rugby",
    "it-serie-a-elite",
    "fr-top14",
    "int-united-rugby-championship",
  ]).has(slug);
}

export function isSevenCompetition(slug: string) {
  return slug.startsWith("svns-") || slug.includes("sevens") || slug.includes("7s");
}

export function isSouthAmericaCompetition(slug: string) {
  return new Set(["sra"]).has(slug);
}

export function getDisplayGroupName(
  competition: { slug: string; group_name?: string | null },
  labels: { other: string; europe: string; seven: string; southAmerica: string }
) {
  if (isSevenCompetition(competition.slug)) return labels.seven;
  if (isSouthAmericaCompetition(competition.slug)) return labels.southAmerica;
  if (isEuropeCompetition(competition.slug)) return labels.europe;
  return (competition.group_name ?? "").trim() || labels.other;
}

export function getCompetitionGroupPriority(competition: { slug: string; group_name?: string | null }) {
  const rawGroup = (competition.group_name ?? "").trim().toLowerCase();

  if (rawGroup === "argentina") return 10;
  if (isSouthAmericaCompetition(competition.slug) || rawGroup === "south america" || rawGroup === "sudamerica") return 20;
  if (isEuropeCompetition(competition.slug)) return 30;
  if (rawGroup === "international") return 40;
  if (isSevenCompetition(competition.slug)) return 50;
  if (rawGroup === "usa") return 60;

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
  if (slug === "eu-champions-cup") return 6;
  if (slug === "int-united-rugby-championship") return 7;

  return competition.sort_order ?? 9999;
}
