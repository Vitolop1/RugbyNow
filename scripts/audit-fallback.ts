import fs from "node:fs";
import path from "node:path";
import { resolveLeagueLogoPath, resolveTeamLogoSlug } from "../lib/assets";
import { getFallbackCompetitions, getFallbackLeagueData } from "../lib/fallbackData";

function stripPng(file: string) {
  return file.replace(/\.png$/i, "");
}

function main() {
  const root = process.cwd();
  const leagueDir = path.join(root, "public", "league-logos");
  const teamDir = path.join(root, "public", "team-logos");

  const leagueLogos = new Set(
    fs.existsSync(leagueDir) ? fs.readdirSync(leagueDir).filter((file) => file.endsWith(".png")).map(stripPng) : []
  );
  const teamLogos = new Set(
    fs.existsSync(teamDir) ? fs.readdirSync(teamDir).filter((file) => file.endsWith(".png")).map(stripPng) : []
  );

  const report = [];
  const missingLeagueLogos: string[] = [];
  const missingTeamLogos = new Set<string>();

  for (const competition of getFallbackCompetitions()) {
    const data = getFallbackLeagueData(competition.slug, "2026-03-09");
    if (!data) continue;

    const leagueAsset = path.basename(resolveLeagueLogoPath(competition.slug)).replace(/\.png$/i, "");
    if (!leagueLogos.has(leagueAsset) && competition.slug !== "_placeholder") {
      missingLeagueLogos.push(competition.slug);
    }

    for (const match of data.matches) {
      if (match.home_team?.slug && !teamLogos.has(resolveTeamLogoSlug(match.home_team.slug))) {
        missingTeamLogos.add(match.home_team.slug);
      }
      if (match.away_team?.slug && !teamLogos.has(resolveTeamLogoSlug(match.away_team.slug))) {
        missingTeamLogos.add(match.away_team.slug);
      }
    }

    for (const row of data.standings) {
      if (row.teamSlug && !teamLogos.has(resolveTeamLogoSlug(row.teamSlug))) missingTeamLogos.add(row.teamSlug);
    }

    report.push({
      slug: competition.slug,
      name: competition.name,
      matches: data.matches.length,
      rounds: data.roundMeta.length,
      standings: data.standings.length,
      selectedRound: data.selectedRound,
      season: data.season?.name ?? null,
    });
  }

  console.log(JSON.stringify({
    competitions: report,
    missingLeagueLogos: missingLeagueLogos.sort(),
    missingTeamLogos: Array.from(missingTeamLogos).sort(),
  }, null, 2));
}

main();
