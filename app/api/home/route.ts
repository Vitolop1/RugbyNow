import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackMatchesByDate } from "@/lib/fallbackData";
import { getSnapshotMatchesByDate } from "@/lib/supabaseSnapshot";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid or missing date" }, { status: 400 });
  }

  try {
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

    if (error) throw error;

    return NextResponse.json({ matches: data || [], source: "supabase" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const snapshotMatches = getSnapshotMatchesByDate(date);
    if (snapshotMatches) {
      return NextResponse.json({
        matches: snapshotMatches,
        source: "snapshot",
        warning: message,
      });
    }

    return NextResponse.json({
      matches: getFallbackMatchesByDate(date),
      source: "fallback",
      warning: message,
    });
  }
}
