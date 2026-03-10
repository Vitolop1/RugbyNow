import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackCompetitions } from "@/lib/fallbackData";
import { getSnapshotCompetitions } from "@/lib/supabaseSnapshot";

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
        competitions: snapshot,
        source: "snapshot",
        warning: message,
      });
    }

    return NextResponse.json({
      competitions: getFallbackCompetitions(),
      source: "fallback",
      warning: message,
    });
  }
}
