import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET() {
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
    return NextResponse.json(
      {
        error: competitionsError?.message || seasonsError?.message || "Failed to load leagues",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    competitions: competitions || [],
    seasons: seasons || [],
  });
}
