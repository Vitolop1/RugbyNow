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

export function getDisplayGroupName(
  competition: { slug: string; group_name?: string | null },
  labels: { other: string; europe: string; seven: string }
) {
  if (isSevenCompetition(competition.slug)) return labels.seven;
  if (isEuropeCompetition(competition.slug)) return labels.europe;
  return (competition.group_name ?? "").trim() || labels.other;
}
