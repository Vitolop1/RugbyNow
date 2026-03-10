import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/serverSupabase";
import { getFallbackLeagueData } from "@/lib/fallbackData";
import { getSnapshotLeagueData } from "@/lib/supabaseSnapshot";

type StandingsAccumulator = {
  teamId: number;
  team: string;
  teamSlug: string | null;
  pj: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pts: number;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const refISO =
    request.nextUrl.searchParams.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(request.nextUrl.searchParams.get("date") || "")
      ? (request.nextUrl.searchParams.get("date") as string)
      : new Date().toISOString().slice(0, 10);
  const roundOverrideRaw = request.nextUrl.searchParams.get("round");
  const roundOverride =
    roundOverrideRaw && /^\d+$/.test(roundOverrideRaw) ? Number.parseInt(roundOverrideRaw, 10) : null;

  try {
    const { data: competition, error: competitionError } = await serverSupabase
      .from("competitions")
      .select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured")
      .eq("slug", slug)
      .maybeSingle();

    if (competitionError || !competition) throw new Error(`No competition found for slug: ${slug}`);

    const { data: season, error: seasonError } = await serverSupabase
      .from("seasons")
      .select("id,name,competition_id")
      .eq("competition_id", competition.id)
      .order("name", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (seasonError || !season) throw new Error(`No season found for: ${slug}`);

    const { data: competitions, error: competitionsError } = await serverSupabase
      .from("competitions")
      .select("id,name,slug,region,country_code,category,group_name,sort_order,is_featured")
      .order("is_featured", { ascending: false })
      .order("group_name", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (competitionsError) throw competitionsError;

    const { data: roundRows, error: roundError } = await serverSupabase
      .from("matches")
      .select("round, match_date, status")
      .eq("season_id", season.id)
      .not("round", "is", null)
      .order("match_date", { ascending: true });

    if (roundError) throw roundError;

    const roundMap = new Map<number, { first: string; last: string; count: number; ft: number }>();
    for (const row of roundRows || []) {
      const round = typeof row.round === "number" ? row.round : Number.parseInt(String(row.round), 10);
      if (!Number.isFinite(round)) continue;
      const current = roundMap.get(round);
      const date = String(row.match_date);
      const isFt = row.status === "FT";
      if (!current) {
        roundMap.set(round, { first: date, last: date, count: 1, ft: isFt ? 1 : 0 });
      } else {
        if (date < current.first) current.first = date;
        if (date > current.last) current.last = date;
        current.count += 1;
        if (isFt) current.ft += 1;
      }
    }

    const roundMeta = Array.from(roundMap.entries())
      .map(([round, value]) => ({
        round,
        first_date: value.first,
        last_date: value.last,
        matches: value.count,
        ft: value.ft,
      }))
      .sort((a, b) => a.round - b.round);

    const autoSelectedRound =
      roundMeta.find((item) => item.first_date <= refISO && refISO <= item.last_date)?.round ??
      roundMeta.find((item) => item.first_date >= refISO)?.round ??
      roundMeta[0]?.round ??
      null;
    const selectedRound = roundOverride ?? autoSelectedRound;

    const { data: matches, error: matchesError } = await serverSupabase
      .from("matches")
      .select(`
        id, match_date, kickoff_time, status, minute, home_score, away_score, round, venue,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug )
      `)
      .eq("season_id", season.id)
      .eq("round", selectedRound)
      .order("match_date", { ascending: true })
      .order("kickoff_time", { ascending: true });

    if (matchesError) throw matchesError;

    const { data: standingsMatches, error: standingsMatchesError } = await serverSupabase
      .from("matches")
      .select(`
        status, home_score, away_score,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug )
      `)
      .eq("season_id", season.id)
      .eq("status", "FT");

    if (standingsMatchesError) throw standingsMatchesError;

    const table = new Map<number, StandingsAccumulator>();
    for (const row of standingsMatches || []) {
      const home = Array.isArray(row.home_team) ? row.home_team[0] : row.home_team;
      const away = Array.isArray(row.away_team) ? row.away_team[0] : row.away_team;
      if (home?.id && !table.has(home.id)) table.set(home.id, { teamId: home.id, team: home.name, teamSlug: home.slug ?? null, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 });
      if (away?.id && !table.has(away.id)) table.set(away.id, { teamId: away.id, team: away.name, teamSlug: away.slug ?? null, pj: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 });
      if (!home?.id || !away?.id || row.home_score == null || row.away_score == null) continue;
      const h = table.get(home.id);
      const a = table.get(away.id);
      if (!h || !a) continue;
      h.pj += 1; a.pj += 1;
      h.pf += row.home_score; h.pa += row.away_score;
      a.pf += row.away_score; a.pa += row.home_score;
      if (row.home_score > row.away_score) { h.w += 1; h.pts += 4; a.l += 1; }
      else if (row.away_score > row.home_score) { a.w += 1; a.pts += 4; h.l += 1; }
      else { h.d += 1; a.d += 1; h.pts += 2; a.pts += 2; }
    }

    const standings = Array.from(table.values())
      .sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.team.localeCompare(b.team))
      .map((row, index) => ({ ...row, position: index + 1, badge: null }));

    return NextResponse.json({
      competition,
      season,
      competitions: competitions || [],
      roundMeta,
      selectedRound,
      matches: matches || [],
      standings,
      source: "supabase",
    });
  } catch (error) {
    const snapshot = getSnapshotLeagueData(slug, refISO, roundOverride);
    if (snapshot) {
      return NextResponse.json({
        ...snapshot,
        source: "snapshot",
        warning: error instanceof Error ? error.message : String(error),
      });
    }

    const fallback = getFallbackLeagueData(slug, refISO);
    if (!fallback) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : `No competition found for slug: ${slug}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...fallback,
      source: "fallback",
      warning: error instanceof Error ? error.message : String(error),
    });
  }
}
