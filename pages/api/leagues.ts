import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSupabase } from "@/lib/serverSupabase";
import { getFallbackCompetitions, getFallbackSeasons } from "@/lib/fallbackData";
import { getSnapshotCompetitions, getSnapshotSeasons } from "@/lib/supabaseSnapshot";
import { getSeasonSortKey, mergeCompetitionCatalog } from "@/lib/competitionPrefs";

type CompetitionRow = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  country_code?: string | null;
  group_name?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
};

type SeasonRow = {
  id: number;
  name: string;
  competition_id: number;
};

function mergeSeasons(base: SeasonRow[], extra: SeasonRow[]) {
  const out = new Map<string, SeasonRow>();
  for (const item of [...base, ...extra]) {
    const key = `${item.competition_id}:${item.name}`;
    if (!out.has(key)) out.set(key, item);
  }
  return Array.from(out.values()).sort(
    (a, b) =>
      a.competition_id - b.competition_id ||
      getSeasonSortKey(b.name) - getSeasonSortKey(a.name) ||
      b.name.localeCompare(a.name)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const serverSupabase = getServerSupabase();
    const [{ data: competitions, error: competitionsError }, { data: seasons, error: seasonsError }] =
      await Promise.all([
        serverSupabase
          .from("competitions")
          .select("id, name, slug, region, country_code, group_name, sort_order, is_featured")
          .order("group_name", { ascending: true })
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        serverSupabase.from("seasons").select("id, name, competition_id"),
      ]);

    if (competitionsError || seasonsError) {
      throw new Error(competitionsError?.message || seasonsError?.message || "Failed to load leagues");
    }

    return res.status(200).json({
      competitions: mergeCompetitionCatalog((competitions || []) as CompetitionRow[], getFallbackCompetitions() as CompetitionRow[]),
      seasons: seasons || [],
      source: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const competitions = getSnapshotCompetitions();
    const seasons = getSnapshotSeasons();
    if (competitions && seasons) {
      return res.status(200).json({
        competitions: mergeCompetitionCatalog(competitions as CompetitionRow[], getFallbackCompetitions() as CompetitionRow[]),
        seasons: mergeSeasons(seasons, getFallbackSeasons()),
        source: "snapshot",
        warning: message,
      });
    }

    return res.status(200).json({
      competitions: mergeCompetitionCatalog(getFallbackCompetitions() as CompetitionRow[], []),
      seasons: mergeSeasons(getFallbackSeasons(), []),
      source: "fallback",
      warning: message,
    });
  }
}
