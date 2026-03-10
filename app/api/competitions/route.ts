import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const { data, error } = await serverSupabase
    .from("competitions")
    .select("id, name, slug, region, country_code, category, group_name, sort_order, is_featured")
    .order("is_featured", { ascending: false })
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load competitions" },
      { status: 500 }
    );
  }

  return NextResponse.json({ competitions: data || [] });
}
