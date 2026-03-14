import fs from "node:fs";
import path from "node:path";

type SnapshotCompetition = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  country_code?: string | null;
};

type SnapshotSeason = {
  id: number;
  name: string;
  competition_id: number;
};

type SnapshotTeam = {
  id: number;
  name: string;
  slug: string | null;
};

type SnapshotMatch = {
  id: number;
  season_id: number;
  home_team_id: number | null;
  away_team_id: number | null;
};

type SnapshotPayload = {
  competitions: SnapshotCompetition[];
  seasons: SnapshotSeason[];
  teams: SnapshotTeam[];
  matches: SnapshotMatch[];
};

type GeneratedTeamProfile = {
  slug: string;
  displayName: string;
  country?: string;
  city?: string;
  venue?: string;
  founded?: string;
  summary: string;
  history: string;
  wikipediaTitle?: string;
  source: "wikidata" | "generated";
};

type WikipediaPageData = {
  title: string;
  extract?: string;
  wikibaseItem?: string;
};

type WikidataEntity = {
  claims: Record<string, Array<{ mainsnak?: { snaktype?: string; datavalue?: { value: unknown } } }>>;
  labels: Record<string, { language: string; value: string }>;
};

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "supabase-snapshot.json");
const OUTPUT_PATH = path.join(process.cwd(), "data", "team-profiles.generated.json");
const USER_AGENT = "RugbyNowProfileBot/1.0 (https://rugby-now.com; lopresttivito@gmail.com)";

const TEAM_TITLE_OVERRIDES: Record<string, string> = {
  reds: "Queensland Reds",
  waratahs: "New South Wales Waratahs",
  brumbies: "ACT Brumbies",
  crusaders: "Crusaders (rugby union)",
  chiefs: "Chiefs (rugby union)",
  hurricanes: "Hurricanes (rugby union)",
  highlanders: "Highlanders (rugby union)",
  blues: "Blues (Super Rugby)",
  "western-force": "Western Force",
  lions: "Lions (United Rugby Championship)",
  sharks: "Sharks (rugby union)",
  bulls: "Bulls (rugby union)",
  stormers: "Stormers",
  ospreys: "Ospreys (rugby union)",
  dragons: "Dragons RFC",
  ulster: "Ulster Rugby",
  munster: "Munster Rugby",
  leinster: "Leinster Rugby",
  connacht: "Connacht Rugby",
  zebre: "Zebre Parma",
  benetton: "Benetton Rugby",
  "glasgow-warriors": "Glasgow Warriors",
  edinburgh: "Edinburgh Rugby",
  "cardiff-rugby": "Cardiff Rugby",
  "sale-sharks": "Sale Sharks",
  harlequins: "Harlequins",
  bath: "Bath Rugby",
  bristol: "Bristol Bears",
  saracens: "Saracens F.C.",
  gloucester: "Gloucester Rugby",
  "exeter-chiefs": "Exeter Chiefs",
  "newcastle-falcons": "Newcastle Falcons",
  "leicester-tigers": "Leicester Tigers",
  "northampton-saints": "Northampton Saints",
  "stade-rochelais": "Stade Rochelais",
  bayonne: "Aviron Bayonnais",
  lyon: "Lyon OU",
  toulon: "RC Toulon",
  "rc-toulonnais": "RC Toulon",
  "racing-92": "Racing 92",
  "stade-francais": "Stade Francais Paris",
  "stade-toulousain": "Stade Toulousain",
  "bordeaux-begles": "Union Bordeaux Begles",
  "asm-clermont-auvergne": "ASM Clermont Auvergne",
  "montpellier-herault-rugby": "Montpellier Herault Rugby",
  "section-paloise": "Section Paloise",
  "castres-olympique": "Castres Olympique",
  "usa-perpignan": "USA Perpignan",
  montauban: "US Montauban",
  calvisano: "Rugby Calvisano",
  petrarca: "Petrarca Rugby",
  rovigo: "Rugby Rovigo Delta",
  viadana: "Rugby Viadana",
  mogliano: "Mogliano Rugby",
  "fiamme-oro": "Fiamme Oro Rugby",
  colorno: "Rugby Colorno",
  "valorugby-emilia": "Valorugby Emilia",
  "lyons-piacenza": "Rugby Lyons Piacenza",
  "california-legion": "San Diego Legion",
  "seattle-seawolves": "Seattle Seawolves",
  "old-glory-dc": "Old Glory DC",
  "chicago-hounds": "Chicago Hounds",
  "new-england-free-jacks": "New England Free Jacks",
  "anthem-rc": "Anthem Rugby Carolina",
  england: "England national rugby union team",
  france: "France national rugby union team",
  ireland: "Ireland national rugby union team",
  italy: "Italy national rugby union team",
  scotland: "Scotland national rugby union team",
  wales: "Wales national rugby union team",
  argentina: "Argentina national rugby union team",
  australia: "Australia national rugby union team",
  "south-africa": "South Africa national rugby union team",
  "new-zealand": "New Zealand national rugby union team",
  fiji: "Fiji national rugby union team",
  georgia: "Georgia national rugby union team",
  japan: "Japan national rugby union team",
  uruguay: "Uruguay national rugby union team",
  chile: "Chile national rugby union team",
  canada: "Canada national rugby union team",
  portugal: "Portugal national rugby union team",
  spain: "Spain national rugby union team",
  romania: "Romania national rugby union team",
  tonga: "Tonga national rugby union team",
  samoa: "Samoa national rugby union team",
  namibia: "Namibia national rugby union team",
  belgium: "Belgium national rugby union team",
  brazil: "Brazil national rugby union team",
  "hong-kong": "Hong Kong national rugby union team",
  zimbabwe: "Zimbabwe national rugby union team",
  usa: "United States national rugby union team",
  "fiyi-7s": "Fiji national rugby sevens team",
  "nueva-zelanda-7s": "New Zealand national rugby sevens team",
  "gran-bretana-7s": "Great Britain national rugby sevens team",
  "great-britain-7s": "Great Britain national rugby sevens team",
  "kenya-7s": "Kenya national rugby sevens team",
  "sudafrica-7s": "South Africa national rugby sevens team",
  "espana-7s": "Spain national rugby sevens team",
  "francia-7s": "France national rugby sevens team",
};

const TEAM_FACT_OVERRIDES: Record<
  string,
  Partial<Pick<GeneratedTeamProfile, "country" | "city" | "venue" | "founded" | "summary" | "history">>
> = {
  "pampas-xv": {
    country: "Argentina",
    city: "Buenos Aires",
    venue: "Buenos Aires",
  },
  "dogos-xv": {
    country: "Argentina",
    city: "Cordoba",
    venue: "Cordoba",
  },
  "penarol-rugby": {
    country: "Uruguay",
    city: "Montevideo",
    venue: "Montevideo",
  },
  selknam: {
    country: "Chile",
    city: "Santiago",
    venue: "Santiago",
  },
  "yacare-xv": {
    country: "Paraguay",
    city: "Asuncion",
    venue: "Asuncion",
  },
  "cobras-brasil-rugby": {
    country: "Brazil",
    city: "Sao Paulo",
    venue: "Sao Paulo",
  },
  "capibaras-xv": {
    country: "Brazil",
    city: "Sao Paulo",
    venue: "Sao Paulo",
  },
  tarucas: {
    country: "Argentina",
    city: "San Miguel de Tucuman",
    venue: "Tucuman",
  },
  "gimnasia-y-tiro": {
    country: "Argentina",
    city: "Salta",
    venue: "Salta",
  },
  "jockey-club-de-salta": {
    country: "Argentina",
    city: "Salta",
    venue: "Salta",
  },
  "universitario-de-salta": {
    country: "Argentina",
    city: "Salta",
    venue: "Salta",
  },
  "tiro-federal-de-salta": {
    country: "Argentina",
    city: "Salta",
    venue: "Salta",
  },
  "tigres-rc": {
    country: "Argentina",
    city: "Salta",
    venue: "Salta",
  },
  "old-lions-rc": {
    country: "Argentina",
    city: "Santiago del Estero",
    venue: "Santiago del Estero",
  },
  "santiago-rugby-club": {
    country: "Argentina",
    city: "Santiago del Estero",
    venue: "Santiago del Estero",
  },
  "santiago-lawn-tennis-club": {
    country: "Argentina",
    city: "Santiago del Estero",
    venue: "Santiago del Estero",
  },
  reds: {
    country: "Australia",
    city: "Brisbane",
    venue: "Suncorp Stadium",
  },
  waratahs: {
    country: "Australia",
    city: "Sydney",
    venue: "Sydney Football Stadium",
  },
  brumbies: {
    country: "Australia",
    city: "Canberra",
    venue: "GIO Stadium",
  },
  "western-force": {
    country: "Australia",
    city: "Perth",
    venue: "HBF Park",
  },
  crusaders: {
    country: "New Zealand",
    city: "Christchurch",
    venue: "Apollo Projects Stadium",
  },
  chiefs: {
    country: "New Zealand",
    city: "Hamilton",
    venue: "FMG Stadium Waikato",
  },
  blues: {
    country: "New Zealand",
    city: "Auckland",
    venue: "Eden Park",
  },
  highlanders: {
    country: "New Zealand",
    city: "Dunedin",
    venue: "Forsyth Barr Stadium",
  },
  hurricanes: {
    country: "New Zealand",
    city: "Wellington",
    venue: "Sky Stadium",
  },
  "moana-pasifika": {
    country: "New Zealand",
    city: "Auckland",
    venue: "North Harbour Stadium",
  },
  "fijian-drua": {
    country: "Fiji",
    city: "Lautoka",
    venue: "Churchill Park",
  },
  "sale-sharks": {
    country: "England",
    city: "Salford",
    venue: "Salford Community Stadium",
  },
  harlequins: {
    country: "England",
    city: "London",
    venue: "Twickenham Stoop",
  },
  bath: {
    country: "England",
    city: "Bath",
    venue: "The Recreation Ground",
  },
  bristol: {
    country: "England",
    city: "Bristol",
    venue: "Ashton Gate Stadium",
  },
  saracens: {
    country: "England",
    city: "London",
    venue: "StoneX Stadium",
  },
  gloucester: {
    country: "England",
    city: "Gloucester",
    venue: "Kingsholm Stadium",
  },
  "exeter-chiefs": {
    country: "England",
    city: "Exeter",
    venue: "Sandy Park",
  },
  "northampton-saints": {
    country: "England",
    city: "Northampton",
    venue: "Franklin's Gardens",
  },
  "newcastle-falcons": {
    country: "England",
    city: "Newcastle upon Tyne",
    venue: "Kingston Park",
  },
  "leicester-tigers": {
    country: "England",
    city: "Leicester",
    venue: "Welford Road",
  },
  ospreys: {
    country: "Wales",
    city: "Swansea",
    venue: "Swansea.com Stadium",
  },
  dragons: {
    country: "Wales",
    city: "Newport",
    venue: "Rodney Parade",
  },
  scarlets: {
    country: "Wales",
    city: "Llanelli",
    venue: "Parc y Scarlets",
  },
  "cardiff-rugby": {
    country: "Wales",
    city: "Cardiff",
    venue: "Cardiff Arms Park",
  },
  edinburgh: {
    country: "Scotland",
    city: "Edinburgh",
    venue: "Hive Stadium",
  },
  "glasgow-warriors": {
    country: "Scotland",
    city: "Glasgow",
    venue: "Scotstoun Stadium",
  },
  leinster: {
    country: "Ireland",
    city: "Dublin",
    venue: "RDS Arena",
  },
  munster: {
    country: "Ireland",
    city: "Limerick",
    venue: "Thomond Park",
  },
  connacht: {
    country: "Ireland",
    city: "Galway",
    venue: "Dexcom Stadium",
  },
  stormers: {
    country: "South Africa",
    city: "Cape Town",
    venue: "DHL Stadium",
  },
  sharks: {
    country: "South Africa",
    city: "Durban",
    venue: "Kings Park Stadium",
  },
  bulls: {
    country: "South Africa",
    city: "Pretoria",
    venue: "Loftus Versfeld Stadium",
  },
  zebre: {
    country: "Italy",
    city: "Parma",
    venue: "Stadio Sergio Lanfranchi",
  },
  benetton: {
    country: "Italy",
    city: "Treviso",
    venue: "Stadio Comunale di Monigo",
  },
};

const COMPETITION_COUNTRY_FALLBACKS: Record<string, string> = {
  "ar-liga-norte-grande": "Argentina",
  "ar-urba-top14": "Argentina",
  sra: "Argentina",
  "us-mlr": "United States",
  "fr-top14": "France",
  "it-serie-a-elite": "Italy",
  "en-premiership-rugby": "England",
  "eu-champions-cup": "Europe",
  "int-united-rugby-championship": "Europe",
  "int-super-rugby-pacific": "Australia / New Zealand / Pacific",
};

const EXACT_TITLE_CACHE = new Map<string, WikipediaPageData | null>();
const SEARCH_CACHE = new Map<string, string | null>();
const WIKIDATA_CACHE = new Map<string, WikidataEntity | null>();
const LABEL_CACHE = new Map<string, string | undefined>();

function loadSnapshot() {
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8")) as SnapshotPayload;
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseFallback(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function parseFoundedYear(raw?: unknown) {
  if (!raw || typeof raw !== "object" || raw == null || !("time" in raw)) return undefined;
  const time = String((raw as { time?: string }).time ?? "");
  const match = time.match(/[+-](\d{4})-/);
  return match ? match[1] : undefined;
}

function firstClaimValue(entity: WikidataEntity | null, property: string) {
  const claim = entity?.claims?.[property]?.find((entry) => entry.mainsnak?.snaktype === "value");
  return claim?.mainsnak?.datavalue?.value;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchPageByExactTitle(title: string) {
  if (EXACT_TITLE_CACHE.has(title)) return EXACT_TITLE_CACHE.get(title) ?? null;

  const url =
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops&exintro=1&explaintext=1` +
    `&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;

  const payload = await fetchJson<{
    query?: {
      pages?: Record<
        string,
        {
          missing?: string;
          title?: string;
          extract?: string;
          pageprops?: { wikibase_item?: string };
        }
      >;
    };
  }>(url).catch(() => null);

  if (!payload?.query?.pages) {
    EXACT_TITLE_CACHE.set(title, null);
    return null;
  }

  const page = Object.values(payload.query.pages).find((entry) => !entry.missing);
  if (!page?.title) {
    EXACT_TITLE_CACHE.set(title, null);
    return null;
  }

  const result: WikipediaPageData = {
    title: page.title,
    extract: page.extract,
    wikibaseItem: page.pageprops?.wikibase_item,
  };
  EXACT_TITLE_CACHE.set(title, result);
  return result;
}

async function searchWikipediaTitle(query: string) {
  if (SEARCH_CACHE.has(query)) return SEARCH_CACHE.get(query) ?? null;

  const url =
    `https://en.wikipedia.org/w/api.php?action=query&list=search&utf8=1&format=json&origin=*` +
    `&srlimit=5&srsearch=${encodeURIComponent(query)}`;
  const payload = await fetchJson<{
    query?: {
      search?: Array<{ title: string; snippet: string }>;
    };
  }>(url).catch(() => null);

  const normalizedQuery = normalizeToken(query);
  const queryTokens = normalizedQuery
    .split(" ")
    .filter((token) => token.length >= 4 && !["rugby", "union", "club", "team", "national"].includes(token));
  const results = payload?.query?.search ?? [];
  const picked =
    results.find((result) => {
      const haystack = normalizeToken(`${result.title} ${result.snippet}`);
      const hasRugby = haystack.includes("rugby");
      const tokenMatch = queryTokens.length === 0 || queryTokens.some((token) => haystack.includes(token));
      return hasRugby && tokenMatch;
    }) ?? results[0];

  const title = picked?.title ?? null;
  SEARCH_CACHE.set(query, title);
  return title;
}

async function fetchWikidataEntity(qid?: string) {
  if (!qid) return null;
  if (WIKIDATA_CACHE.has(qid)) return WIKIDATA_CACHE.get(qid) ?? null;

  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}` +
    `&props=claims|labels&languages=es|en&format=json&origin=*`;
  const payload = await fetchJson<{
    entities?: Record<string, WikidataEntity>;
  }>(url).catch(() => null);

  const entity = payload?.entities?.[qid] ?? null;
  WIKIDATA_CACHE.set(qid, entity);
  return entity;
}

async function resolveEntityLabel(id?: string) {
  if (!id) return undefined;
  if (LABEL_CACHE.has(id)) return LABEL_CACHE.get(id);
  const entity = await fetchWikidataEntity(id);
  const label = entity?.labels?.es?.value ?? entity?.labels?.en?.value;
  LABEL_CACHE.set(id, label);
  return label;
}

function inferCountryFromCompetition(competitionSlugs: string[]) {
  for (const slug of competitionSlugs) {
    const fallback = COMPETITION_COUNTRY_FALLBACKS[slug];
    if (fallback) return fallback;
  }
  return undefined;
}

function isSevensTeam(team: SnapshotTeam, competitionSlugs: string[]) {
  const name = normalizeToken(team.name);
  const slug = normalizeToken(team.slug ?? "");
  return slug.endsWith("7s") || name.includes("7s") || competitionSlugs.some((item) => item.startsWith("svns-"));
}

function isNationalTeam(team: SnapshotTeam, competitionSlugs: string[]) {
  const slug = normalizeToken(team.slug ?? "");
  const teamName = normalizeToken(team.name);
  return (
    competitionSlugs.some((item) =>
      ["int-six-nations", "int-world-cup", "int-nations-championship"].includes(item)
    ) ||
    [
      "argentina",
      "australia",
      "belgium",
      "brazil",
      "canada",
      "chile",
      "england",
      "fiji",
      "france",
      "georgia",
      "hong kong",
      "ireland",
      "italy",
      "japan",
      "namibia",
      "new zealand",
      "portugal",
      "romania",
      "samoa",
      "scotland",
      "south africa",
      "spain",
      "tonga",
      "uruguay",
      "usa",
      "wales",
      "zimbabwe",
    ].includes(slug) ||
    teamName === "usa"
  );
}

function buildCompetitionText(names: string[]) {
  const trimmed = names.filter(Boolean);
  if (trimmed.length === 0) return "las competencias que sigue RugbyNow";
  if (trimmed.length === 1) return trimmed[0];
  if (trimmed.length === 2) return `${trimmed[0]} y ${trimmed[1]}`;
  return `${trimmed[0]}, ${trimmed[1]} y ${trimmed.length - 2} mas`;
}

function compactExtract(extract?: string) {
  if (!extract) return undefined;
  return extract
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function buildGeneratedCopy(args: {
  team: SnapshotTeam;
  country?: string;
  city?: string;
  venue?: string;
  founded?: string;
  competitionNames: string[];
  national: boolean;
  sevens: boolean;
}) {
  const { team, country, city, venue, founded, competitionNames, national, sevens } = args;
  const competitionText = buildCompetitionText(competitionNames.slice(0, 3));
  const place =
    city && country && normalizeToken(city) !== normalizeToken(country)
      ? `${city}, ${country}`
      : city || country;

  let subject = "club de rugby";
  if (national && sevens) subject = "seleccion nacional de rugby seven";
  else if (national) subject = "seleccion nacional de rugby";
  else if (competitionNames.some((name) => /super rugby|united rugby championship|major league rugby/i.test(name))) {
    subject = "equipo profesional de rugby";
  }

  const summary =
    `${team.name} es ${subject}${place ? ` de ${place}` : ""}. ` +
    `${competitionText ? `En RugbyNow aparece vinculado a ${competitionText}.` : "Forma parte de la cobertura internacional de RugbyNow."}`;

  const historyParts = [
    founded ? `Su origen institucional figura alrededor de ${founded}.` : null,
    venue ? `Juega como local en ${venue}.` : null,
    competitionText ? `Dentro de RugbyNow lo seguimos sobre todo por ${competitionText}.` : null,
  ].filter(Boolean);

  return {
    summary,
    history:
      historyParts.join(" ") ||
      `Perfil en desarrollo. Esta ficha se apoya en metadata publica y en los torneos donde ${team.name} aparece en el snapshot actual de RugbyNow.`,
  };
}

function buildSearchQueries(team: SnapshotTeam, competitionNames: string[], competitionSlugs: string[]) {
  const overrideTitle = team.slug ? TEAM_TITLE_OVERRIDES[team.slug] : undefined;
  if (overrideTitle) return [overrideTitle];

  const queries = new Set<string>();
  const sevens = isSevensTeam(team, competitionSlugs);
  const national = isNationalTeam(team, competitionSlugs);

  if (national && sevens) {
    const base = team.name.replace(/\s*7s$/i, "").trim();
    queries.add(`${base} national rugby sevens team`);
    queries.add(`${base} rugby sevens`);
  } else if (national) {
    queries.add(`${team.name} national rugby union team`);
    queries.add(`${team.name} rugby union`);
  } else {
    queries.add(`${team.name} rugby union`);
    queries.add(`${team.name} rugby club`);
    if (competitionNames.length) queries.add(`${team.name} ${competitionNames[0]} rugby`);
  }

  return Array.from(queries);
}

async function enrichTeam(
  team: SnapshotTeam,
  competitionNames: string[],
  competitionSlugs: string[]
): Promise<GeneratedTeamProfile> {
  const manual = team.slug ? TEAM_FACT_OVERRIDES[team.slug] ?? {} : {};
  const queries = buildSearchQueries(team, competitionNames, competitionSlugs);

  let page: WikipediaPageData | null = null;
  for (const query of queries) {
    const exact = await fetchPageByExactTitle(query);
    if (exact) {
      page = exact;
      break;
    }
    const title = await searchWikipediaTitle(query);
    if (!title) continue;
    const searched = await fetchPageByExactTitle(title);
    if (searched) {
      page = searched;
      break;
    }
  }

  const entity = page?.wikibaseItem ? await fetchWikidataEntity(page.wikibaseItem) : null;
  const country = manual.country
    ?? (await resolveEntityLabel((firstClaimValue(entity, "P17") as { id?: string } | undefined)?.id))
    ?? inferCountryFromCompetition(competitionSlugs);
  const city = manual.city
    ?? (await resolveEntityLabel((firstClaimValue(entity, "P159") as { id?: string } | undefined)?.id))
    ?? (await resolveEntityLabel((firstClaimValue(entity, "P131") as { id?: string } | undefined)?.id));
  const venue = manual.venue
    ?? (await resolveEntityLabel((firstClaimValue(entity, "P115") as { id?: string } | undefined)?.id));
  const founded = manual.founded ?? parseFoundedYear(firstClaimValue(entity, "P571"));

  const generatedCopy = buildGeneratedCopy({
    team,
    country,
    city,
    venue,
    founded,
    competitionNames,
    national: isNationalTeam(team, competitionSlugs),
    sevens: isSevensTeam(team, competitionSlugs),
  });

  return {
    slug: team.slug ?? normalizeToken(team.name).replace(/\s+/g, "-"),
    displayName: team.name,
    country,
    city,
    venue,
    founded,
    summary: manual.summary ?? generatedCopy.summary,
    history: manual.history ?? generatedCopy.history,
    wikipediaTitle: page?.title,
    source: page?.wikibaseItem ? "wikidata" : "generated",
  };
}

async function run() {
  const snapshot = loadSnapshot();
  const seasonsById = new Map(snapshot.seasons.map((row) => [row.id, row]));
  const competitionsById = new Map(snapshot.competitions.map((row) => [row.id, row]));
  const teamCompetitionMap = new Map<number, Set<string>>();

  for (const match of snapshot.matches) {
    const season = seasonsById.get(match.season_id);
    const competition = season ? competitionsById.get(season.competition_id) : null;
    if (!competition) continue;

    for (const teamId of [match.home_team_id, match.away_team_id]) {
      if (!teamId) continue;
      const set = teamCompetitionMap.get(teamId) ?? new Set<string>();
      set.add(competition.slug);
      teamCompetitionMap.set(teamId, set);
    }
  }

  const profiles: Record<string, GeneratedTeamProfile> = {};

  for (const team of snapshot.teams) {
    if (!team.slug) continue;
    const competitionSlugs = Array.from(teamCompetitionMap.get(team.id) ?? []).sort();
    const competitionNames = competitionSlugs
      .map((slug) => snapshot.competitions.find((competition) => competition.slug === slug)?.name)
      .filter((value): value is string => !!value);

    const profile = await enrichTeam(team, competitionNames, competitionSlugs);
    profiles[team.slug] = profile;
    console.log(`profiled ${team.slug} (${profile.source})`);
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalTeams: Object.keys(profiles).length,
        profiles,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(`Wrote ${Object.keys(profiles).length} profiles to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
