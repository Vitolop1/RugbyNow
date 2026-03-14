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
  const deduped = Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))
  );
  window.localStorage.setItem(key, JSON.stringify(deduped));
}

export function readOrderedKeys(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function writeOrderedKeys(key: string, values: string[]) {
  if (typeof window === "undefined") return;
  const deduped = Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
  window.localStorage.setItem(key, JSON.stringify(deduped));
}

export function toggleSlug(values: string[], slug: string) {
  return values.includes(slug) ? values.filter((value) => value !== slug) : [...values, slug];
}

export function moveSlug(values: string[], slug: string, direction: -1 | 1) {
  const deduped = Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))
  );
  const currentIndex = deduped.indexOf(slug);
  if (currentIndex === -1) return deduped;

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= deduped.length) return deduped;

  const next = deduped.slice();
  const [moved] = next.splice(currentIndex, 1);
  next.splice(nextIndex, 0, moved);
  return next;
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

type CompetitionIdentity = CompetitionLike & {
  id?: number | null;
  category?: string | null;
};

export type CompetitionCountryKey =
  | "argentina"
  | "southamerica"
  | "europe"
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
  southamerica: string;
  europe: string;
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

const EUROPE_COMPETITION_SLUGS = new Set([
  "eu-champions-cup",
  "int-united-rugby-championship",
]);

const FRANCHISE_COMPETITION_SLUGS = new Set([
  "int-super-rugby-pacific",
]);

const COUNTRY_ORDER: CompetitionCountryKey[] = [
  "argentina",
  "southamerica",
  "europe",
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

export function getSeasonSortKey(name: string) {
  const value = (name || "").trim();
  const rangeMatch = value.match(/\b(\d{4})\s*\/\s*(\d{2,4})\b/);
  if (rangeMatch) {
    const firstYear = Number.parseInt(rangeMatch[1], 10);
    const secondChunk = rangeMatch[2];
    const secondYear =
      secondChunk.length === 2
        ? Number.parseInt(`${rangeMatch[1].slice(0, 2)}${secondChunk}`, 10)
        : Number.parseInt(secondChunk, 10);
    return Math.max(firstYear, secondYear);
  }

  const yearMatch = value.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) return Number.parseInt(yearMatch[1], 10);
  return 0;
}

export function mergeCompetitionCatalog<T extends CompetitionIdentity>(base: T[], extra: T[]) {
  const bySlug = new Map<string, T>();

  for (const item of base) {
    if (!item?.slug) continue;
    bySlug.set(item.slug.trim().toLowerCase(), { ...item });
  }

  for (const item of extra) {
    if (!item?.slug) continue;
    const key = item.slug.trim().toLowerCase();
    const current = bySlug.get(key);

    if (!current) {
      bySlug.set(key, { ...item });
      continue;
    }

    bySlug.set(key, {
      ...current,
      region: item.region ?? current.region ?? null,
      country_code: item.country_code ?? current.country_code ?? null,
      category: item.category ?? current.category ?? null,
      group_name: item.group_name ?? current.group_name ?? null,
      sort_order: item.sort_order ?? current.sort_order ?? null,
      is_featured: item.is_featured ?? current.is_featured ?? null,
    });
  }

  return Array.from(bySlug.values()).sort(
    (a, b) =>
      Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) ||
      String(a.group_name || "").localeCompare(String(b.group_name || "")) ||
      (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
      String(a.name || "").localeCompare(String(b.name || ""))
  );
}

export function applyNavigationSectionOrder<T extends CompetitionLike>(
  sections: CompetitionNavigationSection<T>[],
  orderedKeys: string[]
) {
  if (!orderedKeys.length) return sections;

  const ranked = new Map<string, number>();
  orderedKeys.forEach((key, index) => ranked.set(key, index));

  return [...sections].sort((a, b) => {
    const aRank = ranked.get(a.key);
    const bRank = ranked.get(b.key);
    if (aRank == null && bRank == null) return 0;
    if (aRank == null) return 1;
    if (bRank == null) return -1;
    return aRank - bRank;
  });
}

export function moveNavigationSectionKey(
  keys: string[],
  key: string,
  direction: -1 | 1,
  availableKeys: string[]
) {
  const normalized = Array.from(
    new Set([
      ...keys.filter((value) => availableKeys.includes(value)),
      ...availableKeys.filter((value) => !keys.includes(value)),
    ])
  );

  const currentIndex = normalized.indexOf(key);
  if (currentIndex === -1) return normalized;

  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= normalized.length) return normalized;

  const next = normalized.slice();
  const [moved] = next.splice(currentIndex, 1);
  next.splice(nextIndex, 0, moved);
  return next;
}

export function reorderNavigationSectionKeys(
  keys: string[],
  draggedKey: string,
  targetKey: string,
  availableKeys: string[]
) {
  if (!draggedKey || !targetKey || draggedKey === targetKey) {
    return Array.from(
      new Set([
        ...keys.filter((value) => availableKeys.includes(value)),
        ...availableKeys.filter((value) => !keys.includes(value)),
      ])
    );
  }

  const normalized = Array.from(
    new Set([
      ...keys.filter((value) => availableKeys.includes(value)),
      ...availableKeys.filter((value) => !keys.includes(value)),
    ])
  );

  const draggedIndex = normalized.indexOf(draggedKey);
  const targetIndex = normalized.indexOf(targetKey);
  if (draggedIndex === -1 || targetIndex === -1) return normalized;

  const next = normalized.slice();
  const [dragged] = next.splice(draggedIndex, 1);
  const adjustedTargetIndex = next.indexOf(targetKey);
  next.splice(adjustedTargetIndex, 0, dragged);
  return next;
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

export function isEuropeSectionCompetition(competition: CompetitionLike) {
  return EUROPE_COMPETITION_SLUGS.has(competition.slug.toLowerCase());
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
  const selections: T[] = [];
  const seven: T[] = [];
  const franchises: T[] = [];
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

    if (isSouthAmericaCompetition(competition.slug.toLowerCase())) {
      if (!byCountry.has("southamerica")) byCountry.set("southamerica", []);
      byCountry.get("southamerica")!.push(competition);
      continue;
    }

    if (isEuropeSectionCompetition(competition)) {
      if (!byCountry.has("europe")) byCountry.set("europe", []);
      byCountry.get("europe")!.push(competition);
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
    southamerica: labels.southamerica,
    europe: labels.europe,
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
  if (isEuropeSectionCompetition({ slug })) return "europe";
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

  const explicitPriority: Record<string, number> = {
    "fr-top14": 10,
    "it-serie-a-elite": 20,
    "int-united-rugby-championship": 30,
    "eu-champions-cup": 40,
    "int-super-rugby-pacific": 50,
    "en-premiership-rugby": 60,
    "int-six-nations": 70,
    "int-nations-championship": 80,
    "int-world-cup": 90,
    sra: 100,
    "svns-australia": 110,
    "svns-usa": 111,
    "svns-hong-kong": 112,
    "svns-singapore": 113,
    "us-mlr": 120,
    "ar-urba-top14": 130,
    "ar-liga-norte-grande": 140,
  };

  if (explicitPriority[slug] != null) return explicitPriority[slug];
  if (competition.country_code === "ES" || slug.includes("spain") || region.includes("spain") || name.includes("spain")) return 150;

  return competition.sort_order ?? 9999;
}
