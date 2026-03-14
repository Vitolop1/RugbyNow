import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSupabase } from "@/lib/serverSupabase";
import { getFallbackCompetitions } from "@/lib/fallbackData";
import { getSnapshotCompetitions } from "@/lib/supabaseSnapshot";
import { mergeCompetitionCatalog } from "@/lib/competitionPrefs";

type CompetitionRow = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  country_code?: string | null;
  category?: string | null;
  group_name?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  try {
    const serverSupabase = getServerSupabase();
    const { data, error } = await serverSupabase
      .from("competitions")
      .select("id, name, slug, region, country_code, category, group_name, sort_order, is_featured")
      .order("is_featured", { ascending: false })
      .order("group_name", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return res.status(200).json({
      competitions: mergeCompetitionCatalog((data || []) as CompetitionRow[], getFallbackCompetitions() as CompetitionRow[]),
      source: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshot = getSnapshotCompetitions();
    if (snapshot) {
      return res.status(200).json({
        competitions: mergeCompetitionCatalog(snapshot as CompetitionRow[], getFallbackCompetitions() as CompetitionRow[]),
        source: "snapshot",
        warning: message,
      });
    }

    return res.status(200).json({
      competitions: mergeCompetitionCatalog(getFallbackCompetitions() as CompetitionRow[], []),
      source: "fallback",
      warning: message,
    });
  }
}
