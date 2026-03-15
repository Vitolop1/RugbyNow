import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readRuntimeEnv } from "../lib/runtimeEnv";

loadEnvConfig(process.cwd());

type MatchStatus = "NS" | "LIVE" | "HT" | "FT" | "CANC";

type FlashInput = {
  compSlug: string | null;
  url: string;
};

type LiveMatchCandidate = {
  season_id: number | null;
  source_url: string | null;
  status: MatchStatus | null;
  match_date: string;
  kickoff_time: string | null;
};

type SeasonRow = {
  id: number;
  competition_id: number | null;
};

type CompetitionRow = {
  id: number;
  slug: string;
};

process.env.LIVE_ONLY = "1";
process.env.MATCHES_ONLY = "1";

function normalizeFlashUrl(raw: string) {
  const url = new URL(raw.trim());
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function parseFlashInputs(raw: string | undefined) {
  if (!raw) {
    throw new Error("Missing env var: FLASH_URLS");
  }

  const tokens = raw
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  const inputs: FlashInput[] = [];

  for (const token of tokens) {
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      const compSlug = token.slice(0, eqIndex).trim() || null;
      const url = token.slice(eqIndex + 1).trim();
      inputs.push({ compSlug, url: normalizeFlashUrl(url) });
      continue;
    }

    inputs.push({ compSlug: competitionSlugFromUrl(token), url: normalizeFlashUrl(token) });
  }

  return inputs;
}

function competitionSlugFromUrl(raw: string) {
  const normalized = normalizeFlashUrl(raw);
  const url = new URL(normalized);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 3 || parts[0] !== "rugby-union") return null;

  const regionOrCountry = parts[1];
  const compSlug = parts[2];

  if (compSlug === "top-14") return "fr-top14";
  if (compSlug === "serie-a-elite") return "it-serie-a-elite";
  if (compSlug === "six-nations") return "int-six-nations";
  if (compSlug === "super-rugby-americas") return "sra";
  if (compSlug === "premiership-rugby") return "en-premiership-rugby";
  if (compSlug === "european-rugby-champions-cup") return "eu-champions-cup";
  if (compSlug === "world-cup") return "int-world-cup";
  if (compSlug === "nations-championship") return "int-nations-championship";
  if (compSlug === "super-rugby") return "int-super-rugby-pacific";
  if (compSlug === "united-rugby-championship") return "int-united-rugby-championship";
  if (compSlug === "major-league-rugby") return "us-mlr";
  if (compSlug === "svns-australia") return "svns-australia";
  if (compSlug === "svns-usa") return "svns-usa";
  if (compSlug === "svns-hong-kong") return "svns-hong-kong";
  if (compSlug === "svns-singapore") return "svns-singapore";

  if (regionOrCountry === "argentina" && compSlug === "top-14") {
    return "ar-urba-top14";
  }

  return null;
}

async function buildLiveOnlyFlashUrls() {
  const flashInputs = parseFlashInputs(readRuntimeEnv("FLASH_URLS") ?? process.env.FLASH_URLS);
  const supabaseUrl = readRuntimeEnv("SUPABASE_URL") ?? process.env.SUPABASE_URL;
  const serviceRoleKey =
    readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars for live runner");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const { data: rawMatches, error: matchesError } = await supabase
    .from("matches")
    .select("season_id,source_url,status,match_date,kickoff_time")
    .gte("match_date", yesterday.toISOString().slice(0, 10))
    .lte("match_date", tomorrow.toISOString().slice(0, 10))
    .neq("status", "FT")
    .limit(80);

  if (matchesError) throw matchesError;

  const candidates = (rawMatches as LiveMatchCandidate[] | null) ?? [];

  if (!candidates.length) {
    return [];
  }

  const inputsBySlug = new Map<string, FlashInput>();
  const inputsByUrl = new Map<string, FlashInput>();

  for (const input of flashInputs) {
    inputsByUrl.set(input.url, input);
    if (input.compSlug) {
      inputsBySlug.set(input.compSlug, input);
    }
  }

  const activeInputs = new Map<string, FlashInput>();
  const unresolvedSeasonIds = new Set<number>();

  for (const candidate of candidates) {
    const sourceUrl = candidate.source_url ? normalizeFlashUrl(candidate.source_url) : null;
    if (sourceUrl && inputsByUrl.has(sourceUrl)) {
      const match = inputsByUrl.get(sourceUrl)!;
      activeInputs.set(match.url, match);
      continue;
    }

    if (candidate.season_id) {
      unresolvedSeasonIds.add(candidate.season_id);
    }
  }

  if (unresolvedSeasonIds.size > 0) {
    const seasonIds = Array.from(unresolvedSeasonIds);
    const { data: rawSeasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("id,competition_id")
      .in("id", seasonIds);

    if (seasonsError) throw seasonsError;

    const seasons = (rawSeasons as SeasonRow[] | null) ?? [];
    const competitionIds = Array.from(
      new Set(seasons.map((season) => season.competition_id).filter((value): value is number => Number.isInteger(value)))
    );

    const competitionsById = new Map<number, CompetitionRow>();

    if (competitionIds.length > 0) {
      const { data: rawCompetitions, error: competitionsError } = await supabase
        .from("competitions")
        .select("id,slug")
        .in("id", competitionIds);

      if (competitionsError) throw competitionsError;

      for (const competition of ((rawCompetitions as CompetitionRow[] | null) ?? [])) {
        competitionsById.set(competition.id, competition);
      }
    }

    for (const season of seasons) {
      if (!season.competition_id) continue;
      const competition = competitionsById.get(season.competition_id);
      if (!competition) continue;
      const input = inputsBySlug.get(competition.slug);
      if (!input) continue;
      activeInputs.set(input.url, input);
    }
  }

  return flashInputs.filter((input) => activeInputs.has(input.url));
}

async function main() {
  const activeInputs = await buildLiveOnlyFlashUrls();

  if (activeInputs.length === 0) {
    console.log("sync:live -> no active competitions detected. Skipping scraper fast.");
    return;
  }

  process.env.FLASH_URLS = activeInputs
    .map((input) => (input.compSlug ? `${input.compSlug}=${input.url}` : input.url))
    .join("\n");

  console.log(
    "sync:live -> active competitions:",
    activeInputs.map((input) => input.compSlug ?? input.url).join(", ")
  );

  await import("./sync-flashscore");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
