import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getTeamProfile } from "@/lib/teamProfiles";

type SnapshotCompetition = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  country_code?: string | null;
  group_name?: string | null;
};

type SnapshotSeason = {
  id: number;
  name: string;
  competition_id: number;
};

type SnapshotTeam = {
  id: number;
  name: string;
  slug: string | null;
};

type SnapshotMatch = {
  id: number;
  season_id: number;
  match_date: string;
  kickoff_time: string | null;
  status: "NS" | "LIVE" | "FT";
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
};

type SnapshotPayload = {
  competitions: SnapshotCompetition[];
  seasons: SnapshotSeason[];
  teams: SnapshotTeam[];
  matches: SnapshotMatch[];
};

function snapshotPath() {
  return path.join(process.cwd(), "data", "supabase-snapshot.json");
}

function loadSnapshot() {
  const raw = fs.readFileSync(snapshotPath(), "utf8");
  return JSON.parse(raw) as SnapshotPayload;
}

function dedupeByMatchId<T extends { id: number }>(rows: T[]) {
  const seen = new Set<number>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  try {
    const snapshot = loadSnapshot();
    const team = snapshot.teams.find((row) => row.slug === slug);

    if (!team) {
      return NextResponse.json({ error: `Team not found: ${slug}` }, { status: 404 });
    }

    const seasonsById = new Map(snapshot.seasons.map((season) => [season.id, season]));
    const competitionsById = new Map(snapshot.competitions.map((competition) => [competition.id, competition]));

    const allMatches = dedupeByMatchId(
      snapshot.matches.filter((match) => match.home_team_id === team.id || match.away_team_id === team.id)
    ).sort(
      (a, b) =>
        b.match_date.localeCompare(a.match_date) ||
        String(b.kickoff_time || "").localeCompare(String(a.kickoff_time || ""))
    );

    const recentMatches = allMatches.slice(0, 10).map((match) => {
      const season = seasonsById.get(match.season_id) ?? null;
      const competition = season ? competitionsById.get(season.competition_id) ?? null : null;
      const home = snapshot.teams.find((row) => row.id === match.home_team_id) ?? null;
      const away = snapshot.teams.find((row) => row.id === match.away_team_id) ?? null;

      return {
        ...match,
        season,
        competition,
        home_team: home,
        away_team: away,
      };
    });

    const upcomingMatches = allMatches
      .filter((match) => match.status !== "FT")
      .slice()
      .reverse()
      .slice(0, 6)
      .map((match) => {
        const season = seasonsById.get(match.season_id) ?? null;
        const competition = season ? competitionsById.get(season.competition_id) ?? null : null;
        const home = snapshot.teams.find((row) => row.id === match.home_team_id) ?? null;
        const away = snapshot.teams.find((row) => row.id === match.away_team_id) ?? null;

        return {
          ...match,
          season,
          competition,
          home_team: home,
          away_team: away,
        };
      });

    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    const form: Array<"W" | "D" | "L"> = [];
    const competitions = new Map<string, { slug: string; name: string; region: string | null; seasons: Set<string> }>();

    for (const match of allMatches) {
      const season = seasonsById.get(match.season_id);
      const competition = season ? competitionsById.get(season.competition_id) : null;
      if (competition) {
        if (!competitions.has(competition.slug)) {
          competitions.set(competition.slug, {
            slug: competition.slug,
            name: competition.name,
            region: competition.region,
            seasons: new Set<string>(),
          });
        }
        if (season?.name) competitions.get(competition.slug)!.seasons.add(season.name);
      }

      const isHome = match.home_team_id === team.id;
      if (match.status !== "FT" || match.home_score == null || match.away_score == null) continue;

      played += 1;
      const scored = isHome ? match.home_score : match.away_score;
      const conceded = isHome ? match.away_score : match.home_score;
      pointsFor += scored;
      pointsAgainst += conceded;

      const result = scored > conceded ? "W" : scored < conceded ? "L" : "D";
      if (result === "W") won += 1;
      if (result === "D") drawn += 1;
      if (result === "L") lost += 1;
      if (form.length < 5) form.push(result);
    }

    const profile = getTeamProfile(slug, team.name);

    return NextResponse.json({
      team,
      profile,
      stats: {
        played,
        won,
        drawn,
        lost,
        pointsFor,
        pointsAgainst,
        winRate: played ? Math.round((won / played) * 100) : 0,
        form,
      },
      competitions: Array.from(competitions.values()).map((competition) => ({
        ...competition,
        seasons: Array.from(competition.seasons).sort().reverse(),
      })),
      recentMatches,
      upcomingMatches,
      source: "snapshot",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown team error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
