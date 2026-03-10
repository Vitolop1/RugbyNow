import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackCompetitions, getFallbackSeasons } from "@/lib/fallbackData";
import { getSnapshotCompetitions, getSnapshotSeasons } from "@/lib/supabaseSnapshot";

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

function mergeCompetitions(base: CompetitionRow[], extra: CompetitionRow[]) {
  const bySlug = new Map<string, CompetitionRow>();
  for (const item of [...base, ...extra]) {
    if (!item?.slug) continue;
    if (!bySlug.has(item.slug)) bySlug.set(item.slug, item);
  }
  return Array.from(bySlug.values()).sort(
    (a, b) =>
      String(a.group_name || "").localeCompare(String(b.group_name || "")) ||
      (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
      String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function mergeSeasons(base: SeasonRow[], extra: SeasonRow[]) {
  const out = new Map<string, SeasonRow>();
  for (const item of [...base, ...extra]) {
    const key = `${item.competition_id}:${item.name}`;
    if (!out.has(key)) out.set(key, item);
  }
  return Array.from(out.values());
}

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
          competitions: mergeCompetitions(competitions, getFallbackCompetitions()),
          seasons: mergeSeasons(seasons, getFallbackSeasons()),
          source: "snapshot",
          warning: message,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        competitions: mergeCompetitions(getFallbackCompetitions(), []),
        seasons: mergeSeasons(getFallbackSeasons(), []),
        source: "fallback",
        warning: message,
      },
      { status: 200 }
    );
  }
}
