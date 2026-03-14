import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readRuntimeEnv } from "../lib/runtimeEnv";

loadEnvConfig(process.cwd());

type MatchStatus = "NS" | "LIVE" | "HT" | "FT" | "CANC";

type FlashInput = {
  compSlug: string | null;
  url: string;
};

type LateMatchCandidate = {
  season_id: number | null;
  source_url: string | null;
  status: MatchStatus | null;
  match_date: string;
  kickoff_time: string | null;
  home_score: number | null;
  away_score: number | null;
};

type SeasonRow = {
  id: number;
  competition_id: number | null;
};

type CompetitionRow = {
  id: number;
  slug: string;
};

const FIFTEENS_TOTAL_MINUTES = 100;
const SEVENS_TOTAL_MINUTES = 16;
const FINISH_LOOKAHEAD_MINUTES = 15;
const FINISH_LOOKBACK_MINUTES = 150;

process.env.MATCHES_ONLY = "1";

function normalizeFlashUrl(raw: string) {
  const url = new URL(raw.trim());
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
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

function isSevenCompetition(competitionSlug?: string | null) {
  if (!competitionSlug) return false;
  const slug = competitionSlug.toLowerCase();
  return slug.startsWith("svns-") || slug.includes("sevens");
}

function parseMatchDateTime(matchDate: string, kickoffTime?: string | null) {
  if (!matchDate) return null;
  const time = kickoffTime && kickoffTime.trim() ? kickoffTime.trim() : "00:00";
  const normalized = time.length === 5 ? `${time}:00` : time;
  const value = new Date(`${matchDate}T${normalized}Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isPotentialFinalizationWindow(
  match: LateMatchCandidate,
  competitionSlug?: string | null,
  now = new Date()
) {
  if (match.status === "FT" || match.status === "CANC") return false;
  if (match.status === "LIVE" || match.status === "HT") return true;

  const kickoff = parseMatchDateTime(match.match_date, match.kickoff_time);
  if (!kickoff) return false;

  const regulationMinutes = isSevenCompetition(competitionSlug)
    ? SEVENS_TOTAL_MINUTES
    : FIFTEENS_TOTAL_MINUTES;
  const elapsedMinutes = Math.floor((now.getTime() - kickoff.getTime()) / 60000);
  const hasScore = match.home_score != null || match.away_score != null;

  if (hasScore && elapsedMinutes >= regulationMinutes - FINISH_LOOKAHEAD_MINUTES) {
    return elapsedMinutes <= regulationMinutes + FINISH_LOOKBACK_MINUTES;
  }

  return (
    elapsedMinutes >= regulationMinutes - FINISH_LOOKAHEAD_MINUTES &&
    elapsedMinutes <= regulationMinutes + FINISH_LOOKBACK_MINUTES
  );
}

async function buildFinishOnlyFlashUrls() {
  const flashInputs = parseFlashInputs(readRuntimeEnv("FLASH_URLS") ?? process.env.FLASH_URLS);
  const supabaseUrl = readRuntimeEnv("SUPABASE_URL") ?? process.env.SUPABASE_URL;
  const serviceRoleKey =
    readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars for live finish runner");
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
    .select("season_id,source_url,status,match_date,kickoff_time,home_score,away_score")
    .gte("match_date", yesterday.toISOString().slice(0, 10))
    .lte("match_date", tomorrow.toISOString().slice(0, 10))
    .not("status", "in", "(FT,CANC)")
    .limit(120);

  if (matchesError) throw matchesError;

  const candidates = (rawMatches as LateMatchCandidate[] | null) ?? [];
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

  const seasonIds = Array.from(
    new Set(candidates.map((candidate) => candidate.season_id).filter((value): value is number => Number.isInteger(value)))
  );

  const seasonsById = new Map<number, SeasonRow>();
  const competitionBySeasonId = new Map<number, CompetitionRow>();

  if (seasonIds.length > 0) {
    const { data: rawSeasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("id,competition_id")
      .in("id", seasonIds);

    if (seasonsError) throw seasonsError;

    const seasons = (rawSeasons as SeasonRow[] | null) ?? [];
    for (const season of seasons) {
      seasonsById.set(season.id, season);
    }

    const competitionIds = Array.from(
      new Set(seasons.map((season) => season.competition_id).filter((value): value is number => Number.isInteger(value)))
    );

    if (competitionIds.length > 0) {
      const { data: rawCompetitions, error: competitionsError } = await supabase
        .from("competitions")
        .select("id,slug")
        .in("id", competitionIds);

      if (competitionsError) throw competitionsError;

      const competitions = (rawCompetitions as CompetitionRow[] | null) ?? [];
      const competitionsById = new Map<number, CompetitionRow>();

      for (const competition of competitions) {
        competitionsById.set(competition.id, competition);
      }

      for (const season of seasons) {
        if (!season.competition_id) continue;
        const competition = competitionsById.get(season.competition_id);
        if (!competition) continue;
        competitionBySeasonId.set(season.id, competition);
      }
    }
  }

  for (const candidate of candidates) {
    const seasonCompetition = candidate.season_id
      ? competitionBySeasonId.get(candidate.season_id) ?? null
      : null;

    if (!isPotentialFinalizationWindow(candidate, seasonCompetition?.slug ?? null)) {
      continue;
    }

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
    for (const seasonId of unresolvedSeasonIds) {
      const competition = competitionBySeasonId.get(seasonId);
      if (!competition) continue;
      const input = inputsBySlug.get(competition.slug);
      if (!input) continue;
      activeInputs.set(input.url, input);
    }
  }

  return flashInputs.filter((input) => activeInputs.has(input.url));
}

async function main() {
  const activeInputs = await buildFinishOnlyFlashUrls();

  if (activeInputs.length === 0) {
    console.log("sync:live:finish -> no late matches to finalize. Skipping fast.");
    return;
  }

  process.env.FLASH_URLS = activeInputs
    .map((input) => (input.compSlug ? `${input.compSlug}=${input.url}` : input.url))
    .join("\n");

  console.log(
    "sync:live:finish -> target competitions:",
    activeInputs.map((input) => input.compSlug ?? input.url).join(", ")
  );

  await import("./sync-flashscore");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
