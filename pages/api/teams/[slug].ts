import fs from "node:fs";
import path from "node:path";
import type { NextApiRequest, NextApiResponse } from "next";
import type { MatchStatus } from "@/lib/matchStatus";
import { getCountryProfile } from "@/lib/countryProfiles";
import { dedupeLogicalMatches } from "@/lib/matchIntegrity";
import { getTeamProfile } from "@/lib/teamProfiles";
import bundledSnapshotJson from "@/data/supabase-snapshot.json";

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
  status: MatchStatus;
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

let cachedSnapshot: SnapshotPayload | null | undefined;

function firstString(value: string | string[] | undefined, fallback?: string) {
  if (Array.isArray(value)) return value[0] ?? fallback ?? "";
  return value ?? fallback ?? "";
}

function snapshotPath() {
  return path.join(process.cwd(), "data", "supabase-snapshot.json");
}

function isSnapshotPayload(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<SnapshotPayload>;
  return (
    Array.isArray(candidate.competitions) &&
    Array.isArray(candidate.seasons) &&
    Array.isArray(candidate.teams) &&
    Array.isArray(candidate.matches)
  );
}

function bundledSnapshot(): SnapshotPayload | null {
  return isSnapshotPayload(bundledSnapshotJson) ? bundledSnapshotJson : null;
}

function loadSnapshot() {
  if (cachedSnapshot !== undefined) return cachedSnapshot;

  try {
    const raw = fs.readFileSync(snapshotPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    cachedSnapshot = isSnapshotPayload(parsed) ? parsed : bundledSnapshot();
  } catch {
    cachedSnapshot = bundledSnapshot();
  }

  return cachedSnapshot;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slug = firstString(req.query.slug);

  try {
    const snapshot = loadSnapshot();
    if (!snapshot) {
      return res.status(500).json({ error: "Team snapshot unavailable" });
    }
    const team = snapshot.teams.find((row) => row.slug === slug);

    if (!team) {
      return res.status(404).json({ error: `Team not found: ${slug}` });
    }

    const seasonsById = new Map(snapshot.seasons.map((season) => [season.id, season]));
    const competitionsById = new Map(snapshot.competitions.map((competition) => [competition.id, competition]));

    const allMatches = dedupeLogicalMatches(
      snapshot.matches.filter((match) => match.home_team_id === team.id || match.away_team_id === team.id),
      (match) => ({
        id: match.id,
        matchDate: match.match_date,
        kickoffTime: match.kickoff_time,
        status: match.status,
        homeScore: match.home_score,
        awayScore: match.away_score,
        homeTeamId: match.home_team_id,
        awayTeamId: match.away_team_id,
      })
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
    const countryProfile = getCountryProfile(profile.country);

    return res.status(200).json({
      team,
      profile,
      countryProfile,
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
    return res.status(500).json({ error: message });
  }
}
