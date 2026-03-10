import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid or missing date" }, { status: 400 });
  }

  const { data, error } = await serverSupabase
    .from("matches")
    .select(`
      id,
      match_date,
      kickoff_time,
      status,
      minute,
      home_score,
      away_score,
      home_team:home_team_id ( id, name, slug ),
      away_team:away_team_id ( id, name, slug ),
      season:season_id (
        competition:competition_id ( name, slug, region )
      )
    `)
    .eq("match_date", date)
    .order("kickoff_time", { ascending: true })
    .limit(2000);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load matches" },
      { status: 500 }
    );
  }

  return NextResponse.json({ matches: data || [] });
}
