import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackCompetitions } from "@/lib/fallbackData";
import { getSnapshotCompetitions } from "@/lib/supabaseSnapshot";

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

function mergeCompetitions(base: CompetitionRow[], extra: CompetitionRow[]) {
  const bySlug = new Map<string, CompetitionRow>();
  for (const item of [...base, ...extra]) {
    if (!item?.slug) continue;
    if (!bySlug.has(item.slug)) bySlug.set(item.slug, item);
  }
  return Array.from(bySlug.values()).sort(
    (a, b) =>
      Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) ||
      String(a.group_name || "").localeCompare(String(b.group_name || "")) ||
      (a.sort_order ?? 9999) - (b.sort_order ?? 9999) ||
      String(a.name || "").localeCompare(String(b.name || ""))
  );
}

export async function GET() {
  try {
    const { data, error } = await serverSupabase
      .from("competitions")
      .select("id, name, slug, region, country_code, category, group_name, sort_order, is_featured")
      .order("is_featured", { ascending: false })
      .order("group_name", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ competitions: data || [], source: "supabase" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshot = getSnapshotCompetitions();
    if (snapshot) {
      return NextResponse.json({
        competitions: mergeCompetitions(snapshot, getFallbackCompetitions()),
        source: "snapshot",
        warning: message,
      });
    }

    return NextResponse.json({
      competitions: mergeCompetitions(getFallbackCompetitions(), []),
      source: "fallback",
      warning: message,
    });
  }
}
