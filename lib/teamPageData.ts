import {getUrbaCalendarData,isUrbaRegularDate} from "@/lib/urbaCalendarData";
import {getLnrCalendarData} from "@/lib/proD2CalendarData";
import {worldCup2027Matches} from "@/lib/worldCup2027";
import {teamDisciplineSelection} from "@/lib/teamDiscipline";
import {rugbyDiscipline} from "@/lib/headToHead";
import {getTeamSquads} from "@/lib/teamSquads";
import {getPlayerUpdates} from "@/lib/playerUpdates";
import clubInformation from "@/data/club-information.json";
import teamStaff from "@/data/team-staff.json";
import officialTables from "@/data/official-standings.json";
import fs from "node:fs";
import path from "node:path";
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

function filterCuratedTeamMatches(slug: string, matches: SnapshotMatch[], seasonsById: Map<number, SnapshotSeason>, competitionsById: Map<number, SnapshotCompetition>) {
  if (slug === "old-lions-rc") {
    return matches.filter((match) => {
      const season = seasonsById.get(match.season_id);
      const competition = season ? competitionsById.get(season.competition_id) : null;
      return competition?.slug !== "int-united-rugby-championship";
    });
  }

  if (slug === "lions") {
    return matches.filter((match) => {
      const season = seasonsById.get(match.season_id);
      const competition = season ? competitionsById.get(season.competition_id) : null;
      return competition?.slug !== "ar-liga-norte-grande";
    });
  }

  return matches;
}

export function getTeamPageData(slug:string,requestedDiscipline=""){
    const snapshot = loadSnapshot();
    if (!snapshot) {
      return null;
    }
    const calendars=[getLnrCalendarData("fr-pro-d2")!,getLnrCalendarData("fr-top14")!];
    const proD2={matches:calendars.flatMap(c=>c.matches),pending:calendars.flatMap(c=>c.pending)};
    const knownPro=new Map(proD2.matches.map(m=>[m.id,m]));
    const proSeasons=new Set(snapshot.seasons.filter(s=>s.name==="2026/2027"&&snapshot.competitions.some(c=>c.id===s.competition_id&&["fr-pro-d2","fr-top14"].includes(c.slug))).map(s=>s.id));
    const team = snapshot.teams.find((row) => row.slug === slug);

    if (!team) {
      return null;
    }

    const seasonsById = new Map(snapshot.seasons.map((season) => [season.id, season]));
    const competitionsById = new Map(snapshot.competitions.map((competition) => [competition.id, competition]));
    const worldSeason=snapshot.seasons.find(s=>s.name==="2027"&&snapshot.competitions.some(c=>c.id===s.competition_id&&c.slug==="int-world-cup"));
    const officialWorld=worldCup2027Matches(snapshot.matches).filter(m=>m.home_team.id===team.id||m.away_team.id===team.id).map(m=>({...m,season_id:worldSeason?.id||0,home_team_id:m.home_team.id,away_team_id:m.away_team.id}));
    const officialUrba=getUrbaCalendarData().matches;
    const urbaSeason=officialUrba[0].season_id;
    const candidates = filterCuratedTeamMatches(
      slug,
      [...snapshot.matches.filter(m=>m.season_id!==urbaSeason||!isUrbaRegularDate(m.match_date)).filter(m=>m.season_id!==worldSeason?.id).filter(m=>!proSeasons.has(m.season_id)||knownPro.has(m.id)).map(m=>knownPro.has(m.id)?{...m,match_date:knownPro.get(m.id)!.match_date,kickoff_time:knownPro.get(m.id)!.kickoff_time}:m).filter((match) => match.home_team_id === team.id || match.away_team_id === team.id),...officialUrba.filter(m=>m.home_team_id===team.id||m.away_team_id===team.id),...officialWorld],
      seasonsById,
      competitionsById
    );
    const competitionFor=(m:SnapshotMatch)=>competitionsById.get(seasonsById.get(m.season_id)?.competition_id||0)?.slug||"";
    const discipline=teamDisciplineSelection(candidates.map(competitionFor),requestedDiscipline);
    const teamMatches=candidates.filter(m=>rugbyDiscipline(competitionFor(m))===discipline.selected);

    const allMatches = dedupeLogicalMatches(
      teamMatches,
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

    const recentMatches = allMatches.filter(match=>match.status==="FT"&&match.home_score!==null&&match.away_score!==null).slice(0, 5).map((match) => {
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
      .filter((match) => match.status==="LIVE"||match.status==="HT"||(match.status==="NS"&&match.match_date>=new Date().toISOString().slice(0,10)))
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
    if(discipline.available.length>1){
      profile.summary=`${team.name} · ${discipline.selected==="rugby-sevens"?"Rugby seven":"Rugby XV"}.`;
      profile.history=undefined;
    }
    const countryProfile = getCountryProfile(profile.country);

    return {
      team,
      discipline,
      profile,
      institution:clubInformation.clubs.find(c=>c.teamSlug===slug)||null,
      staff:teamStaff.teams.find(c=>c.teamSlug===slug)||null,
      countryProfile,
      squads:getTeamSquads(slug),
      pendingFixtures:proD2.pending.filter(m=>m.homeSlug===slug||m.awaySlug===slug).slice(0,6),
      playerUpdates:getPlayerUpdates(slug),
      positions:officialTables.tables.flatMap(table=>table.rows.filter(row=>row.slug===slug).map(row=>({competitionSlug:table.competitionSlug,season:table.season,position:row.position,pts:row.pts,sourceUrl:table.sourceUrl,checkedAt:table.checkedAt}))),
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
    };
}
