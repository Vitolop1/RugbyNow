import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FLASH_URLS = process.env.FLASH_URLS;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type CompetitionSeed = {
  slug: string;
  name: string;
  region: string | null;
  country_code: string | null;
  group_name: string | null;
  sort_order: number;
  is_featured: boolean;
  season_name: string;
};

const COMPETITION_SEEDS: Record<string, CompetitionSeed> = {
  "fr-top14": {
    slug: "fr-top14",
    name: "Top 14",
    region: "France",
    country_code: "FR",
    group_name: "France",
    sort_order: 1,
    is_featured: true,
    season_name: "2025/2026",
  },
  "it-serie-a-elite": {
    slug: "it-serie-a-elite",
    name: "Serie A Elite",
    region: "Italy",
    country_code: "IT",
    group_name: "Italy",
    sort_order: 1,
    is_featured: false,
    season_name: "2025/26",
  },
  "int-six-nations": {
    slug: "int-six-nations",
    name: "Six Nations",
    region: "Europe",
    country_code: null,
    group_name: "Europe",
    sort_order: 1,
    is_featured: true,
    season_name: "2026",
  },
  sra: {
    slug: "sra",
    name: "Super Rugby Americas",
    region: "South America",
    country_code: null,
    group_name: "International",
    sort_order: 2,
    is_featured: true,
    season_name: "2025/26",
  },
  "en-premiership-rugby": {
    slug: "en-premiership-rugby",
    name: "Premiership Rugby",
    region: "England",
    country_code: "GB",
    group_name: "Europe",
    sort_order: 3,
    is_featured: true,
    season_name: "2025/2026",
  },
  "eu-champions-cup": {
    slug: "eu-champions-cup",
    name: "European Rugby Champions Cup",
    region: "Europe",
    country_code: null,
    group_name: "Europe",
    sort_order: 4,
    is_featured: true,
    season_name: "2025/2026",
  },
  "int-world-cup": {
    slug: "int-world-cup",
    name: "World Cup",
    region: "World",
    country_code: null,
    group_name: "International",
    sort_order: 5,
    is_featured: false,
    season_name: "2025/2026",
  },
  "int-nations-championship": {
    slug: "int-nations-championship",
    name: "Nations Championship",
    region: "World",
    country_code: null,
    group_name: "International",
    sort_order: 6,
    is_featured: false,
    season_name: "2025/2026",
  },
  "int-super-rugby-pacific": {
    slug: "int-super-rugby-pacific",
    name: "Super Rugby Pacific",
    region: "World",
    country_code: null,
    group_name: "International",
    sort_order: 7,
    is_featured: true,
    season_name: "2025/2026",
  },
  "ar-urba-top14": {
    slug: "ar-urba-top14",
    name: "URBA Top 14",
    region: "Argentina",
    country_code: "AR",
    group_name: "Argentina",
    sort_order: 1,
    is_featured: true,
    season_name: "Current",
  },
  "us-mlr": {
    slug: "us-mlr",
    name: "Major League Rugby",
    region: "USA",
    country_code: "US",
    group_name: "USA",
    sort_order: 1,
    is_featured: true,
    season_name: "2025/2026",
  },
  "int-united-rugby-championship": {
    slug: "int-united-rugby-championship",
    name: "United Rugby Championship",
    region: "Europe",
    country_code: null,
    group_name: "Europe",
    sort_order: 5,
    is_featured: true,
    season_name: "2025/2026",
  },
  "svns-australia": {
    slug: "svns-australia",
    name: "SVNS Australia",
    region: "World",
    country_code: null,
    group_name: "Seven",
    sort_order: 1,
    is_featured: false,
    season_name: "2026",
  },
  "svns-usa": {
    slug: "svns-usa",
    name: "SVNS USA",
    region: "World",
    country_code: null,
    group_name: "Seven",
    sort_order: 2,
    is_featured: false,
    season_name: "2026",
  },
  "svns-hong-kong": {
    slug: "svns-hong-kong",
    name: "SVNS Hong Kong",
    region: "World",
    country_code: null,
    group_name: "Seven",
    sort_order: 3,
    is_featured: false,
    season_name: "2026",
  },
  "svns-singapore": {
    slug: "svns-singapore",
    name: "SVNS Singapore",
    region: "World",
    country_code: null,
    group_name: "Seven",
    sort_order: 4,
    is_featured: false,
    season_name: "2026",
  },
};

function getRequestedSlugs() {
  const slugs = new Set<string>();
  const raw = FLASH_URLS || "";

  for (const line of raw.split(/\r?\n|,/)) {
    const entry = line.trim();
    if (!entry) continue;
    const eq = entry.indexOf("=");
    if (eq > 0) {
      slugs.add(entry.slice(0, eq).trim());
    }
  }

  for (const slug of ["int-united-rugby-championship", "svns-australia", "svns-usa", "svns-hong-kong", "svns-singapore"]) {
    slugs.add(slug);
  }

  return [...slugs].filter((slug) => slug in COMPETITION_SEEDS);
}

async function main() {
  const targetSlugs = getRequestedSlugs();
  if (targetSlugs.length === 0) {
    console.log("No FLASH_URLS slugs found to seed.");
    return;
  }

  const { data: existingCompetitions, error: competitionsError } = await supabase
    .from("competitions")
    .select("id,slug,name")
    .in("slug", targetSlugs);

  if (competitionsError) throw competitionsError;

  const existingBySlug = new Map((existingCompetitions || []).map((row) => [row.slug, row]));
  const missingCompetitionRows = targetSlugs
    .filter((slug) => !existingBySlug.has(slug))
    .map((slug) => {
      const seed = COMPETITION_SEEDS[slug];
      return {
        name: seed.name,
        slug: seed.slug,
        region: seed.region,
        country_code: seed.country_code,
        category: "rugby-union",
        group_name: seed.group_name,
        sort_order: seed.sort_order,
        is_featured: seed.is_featured,
      };
    });

  if (missingCompetitionRows.length > 0) {
    const { error: insertCompetitionsError } = await supabase.from("competitions").insert(missingCompetitionRows);
    if (insertCompetitionsError) throw insertCompetitionsError;
    console.log(`Inserted competitions: ${missingCompetitionRows.map((row) => row.slug).join(", ")}`);
  } else {
    console.log("No missing competitions to insert.");
  }

  const { data: refreshedCompetitions, error: refreshedCompetitionsError } = await supabase
    .from("competitions")
    .select("id,slug")
    .in("slug", targetSlugs);

  if (refreshedCompetitionsError) throw refreshedCompetitionsError;

  const bySlug = new Map((refreshedCompetitions || []).map((row) => [row.slug, row.id]));
  const competitionIds = [...bySlug.values()];

  const { data: existingSeasons, error: seasonsError } = await supabase
    .from("seasons")
    .select("id,name,competition_id")
    .in("competition_id", competitionIds);

  if (seasonsError) throw seasonsError;

  const seasonKeys = new Set(
    (existingSeasons || []).map((row) => `${row.competition_id}:${String(row.name).trim().toLowerCase()}`)
  );

  const missingSeasonRows = targetSlugs.flatMap((slug) => {
    const competitionId = bySlug.get(slug);
    if (!competitionId) return [];

    const seed = COMPETITION_SEEDS[slug];
    const key = `${competitionId}:${seed.season_name.trim().toLowerCase()}`;
    if (seasonKeys.has(key)) return [];

    return [{ competition_id: competitionId, name: seed.season_name }];
  });

  if (missingSeasonRows.length > 0) {
    const { error: insertSeasonsError } = await supabase.from("seasons").insert(missingSeasonRows);
    if (insertSeasonsError) throw insertSeasonsError;
    console.log(
      `Inserted seasons: ${missingSeasonRows.map((row) => `${row.competition_id}:${row.name}`).join(", ")}`
    );
  } else {
    console.log("No missing seasons to insert.");
  }
}

main().catch((error) => {
  console.error("ERROR ensuring Flashscore competitions", error);
  process.exit(1);
});
