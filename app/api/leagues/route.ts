import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackCompetitions, getFallbackSeasons } from "@/lib/fallbackData";
import { getSnapshotCompetitions, getSnapshotSeasons } from "@/lib/supabaseSnapshot";

export async function GET() {
  try {
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
      throw new Error(
        competitionsError?.message || seasonsError?.message || "Failed to load leagues"
      );
    }

    return NextResponse.json({
      competitions: competitions || [],
      seasons: seasons || [],
      source: "supabase",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const competitions = getSnapshotCompetitions();
    const seasons = getSnapshotSeasons();
    if (competitions && seasons) {
      return NextResponse.json(
        {
          competitions,
          seasons,
          source: "snapshot",
          warning: message,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        competitions: getFallbackCompetitions(),
        seasons: getFallbackSeasons(),
        source: "fallback",
        warning: message,
      },
      { status: 200 }
    );
  }
}
