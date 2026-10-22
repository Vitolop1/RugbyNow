import {parseMatchId} from "@/lib/operationalHealth";
import {getUrbaCalendarData} from "@/lib/urbaCalendarData";
import snapshotData from "@/data/supabase-snapshot.json";
import {getLnrCalendarData} from "@/lib/proD2CalendarData";
import {officialWorldCupFixture} from "@/lib/worldCup2027";
import {withOfficialStandings} from "@/lib/standingsOverlay";
import {usableCachedStandings} from "@/lib/sourceStandings";
import type { NextApiRequest, NextApiResponse } from "next";
import { hasConsistentStandingsCache } from "@/lib/matchIntegrity";
import { getServerSupabase } from "@/lib/serverSupabase";
import { getFallbackMatchDetail, isCuratedOnlyCompetition } from "@/lib/fallbackData";
import { getSnapshotMatchDetail } from "@/lib/supabaseSnapshot";
import { getDatabaseHeadToHead, getSnapshotHeadToHead } from "@/lib/headToHeadServer";
import type { HeadToHeadReference } from "@/lib/headToHead";

type MatchStatus = "NS" | "LIVE" | "HT" | "FT" | "CANC";

type TeamRef = {
  id: number;
  name: string;
  slug: string | null;
};

type StandingRow = {
  position: number;
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
  badge?: string | null;
  form?: Array<"W" | "D" | "L">;
};

type MatchRow = {
  id: number;
  season_id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
  minute: number | null;
  updated_at?: string | null;
  source_url?: string | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  venue?: string | null;
  home_team: TeamRef | TeamRef[] | null;
  away_team: TeamRef | TeamRef[] | null;
  season:
    | {
        id: number;
        name: string;
        competition:
          | {
              id: number;
              name: string;
              slug: string;
              region: string | null;
              country_code?: string | null;
            }
          | null;
      }
    | {
        id: number;
        name: string;
        competition:
          | {
              id: number;
              name: string;
              slug: string;
              region: string | null;
              country_code?: string | null;
            }
          | null;
      }[]
    | null;
};

type StandingCacheRow = {
  team_id: number | null;
  position: number | null;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  points_for: number | null;
  points_against: number | null;
  points: number | null;
};

function firstString(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function unwrapTeam(value: TeamRef | TeamRef[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function unwrapSeason(value: MatchRow["season"]) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function historyReference(match: Pick<MatchRow, "id" | "match_date" | "kickoff_time" | "home_team" | "away_team">,
  competitionSlug: string): HeadToHeadReference | null {
  const homeTeam = unwrapTeam(match.home_team);
  const awayTeam = unwrapTeam(match.away_team);
  return homeTeam && awayTeam ? { id: match.id, matchDate: match.match_date, kickoffTime: match.kickoff_time,
    homeTeam, awayTeam, competitionSlug } : null;
}

function hasUsableStandingCache(rows: StandingCacheRow[]) {
  return rows.some(
    (row) =>
      row.played != null ||
      row.won != null ||
      row.drawn != null ||
      row.lost != null ||
      row.points_for != null ||
      row.points_against != null ||
      row.points != null
  );
}

function buildRecentForm(rows: MatchRow[]) {
  const formMap = new Map<number, Array<"W" | "D" | "L">>();
  const sorted = rows
    .filter((item) => item.status === "FT" && item.home_score != null && item.away_score != null)
    .slice()
    .sort(
      (a, b) =>
        b.match_date.localeCompare(a.match_date) || String(b.kickoff_time || "").localeCompare(String(a.kickoff_time || ""))
    );

  for (const row of sorted) {
    const home = unwrapTeam(row.home_team);
    const away = unwrapTeam(row.away_team);
    if (!home?.id || !away?.id || row.home_score == null || row.away_score == null) continue;

    const homeForm = formMap.get(home.id) || [];
    const awayForm = formMap.get(away.id) || [];

    if (homeForm.length < 5) {
      homeForm.push(row.home_score > row.away_score ? "W" : row.home_score < row.away_score ? "L" : "D");
      formMap.set(home.id, homeForm);
    }

    if (awayForm.length < 5) {
      awayForm.push(row.away_score > row.home_score ? "W" : row.away_score < row.home_score ? "L" : "D");
      formMap.set(away.id, awayForm);
    }
  }

  return formMap;
}

function buildComputedStandings(rows: MatchRow[]) {
  const table = new Map<number, StandingRow>();
  const recentForm = buildRecentForm(rows);

  for (const row of rows.filter((item) => item.status === "FT")) {
    const home = unwrapTeam(row.home_team);
    const away = unwrapTeam(row.away_team);
    if (!home || !away) continue;

    if (!table.has(home.id)) {
      table.set(home.id, {
        position: 0,
        teamId: home.id,
        team: home.name,
        teamSlug: home.slug,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
        badge: null,
      });
    }

    if (!table.has(away.id)) {
      table.set(away.id, {
        position: 0,
        teamId: away.id,
        team: away.name,
        teamSlug: away.slug,
        pj: 0,
        w: 0,
        d: 0,
        l: 0,
        pf: 0,
        pa: 0,
        pts: 0,
        badge: null,
      });
    }

    if (row.home_score == null || row.away_score == null) continue;

    const h = table.get(home.id)!;
    const a = table.get(away.id)!;

    h.pj += 1;
    a.pj += 1;
    h.pf += row.home_score;
    h.pa += row.away_score;
    a.pf += row.away_score;
    a.pa += row.home_score;

    if (row.home_score > row.away_score) {
      h.w += 1;
      h.pts += 4;
      a.l += 1;
    } else if (row.away_score > row.home_score) {
      a.w += 1;
      a.pts += 4;
      h.l += 1;
    } else {
      h.d += 1;
      a.d += 1;
      h.pts += 2;
      a.pts += 2;
    }
  }

  return Array.from(table.values())
    .sort((a, b) => b.pts - a.pts || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf || a.team.localeCompare(b.team))
    .map((row, index) => ({ ...row, position: index + 1, form: recentForm.get(row.teamId) ?? [] }));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const matchId = parseMatchId(req.query.id);
  if(matchId===null)return res.status(400).json({error:"Invalid match id"});
  const competitionSlug = firstString(req.query.competition);
  const refISO = /^\d{4}-\d{2}-\d{2}$/.test(firstString(req.query.date))
    ? firstString(req.query.date)
    : new Date().toISOString().slice(0, 10);

  const proD2Pending=getLnrCalendarData(competitionSlug)?.pending.find(m=>m.id===matchId);
  if(proD2Pending)return res.status(200).json({pendingFixture:proD2Pending,source:"official-lnr"});
  const officialFixture=competitionSlug==="int-world-cup"?officialWorldCupFixture(matchId):null;
  if(officialFixture&&matchId<0)return res.status(200).json({competition:{id:21,name:"Rugby World Cup 2027 · Men",slug:"int-world-cup",region:"International"},season:{id:29,name:"2027"},match:officialFixture,standings:[],standingsSource:"unavailable",homeStanding:null,awayStanding:null,headToHead:null,source:"official-world-rugby"});
  const urbaFixture=competitionSlug==="ar-urba-top14"?getUrbaCalendarData().matches.find(m=>m.id===matchId):null;
  if(urbaFixture&&matchId<0)return res.status(200).json(withOfficialStandings({competition:snapshotData.competitions.find(c=>c.slug===competitionSlug)!,season:{id:urbaFixture.season_id,name:"2026"},match:urbaFixture,standings:[],standingsSource:"unavailable",homeStanding:null,awayStanding:null,headToHead:null,source:"official-urba"}));
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return res.status(400).json({ error: "Invalid match id" });
  }

  if (competitionSlug && isCuratedOnlyCompetition(competitionSlug)) {
    const fallbackDetail = getFallbackMatchDetail(competitionSlug, matchId, refISO);
    if (fallbackDetail) {
      return res.status(200).json(withOfficialStandings({
        ...fallbackDetail,
        source: "fallback-curated",
        headToHead: null,
      }));
    }
  }

  try {
    const serverSupabase = getServerSupabase();
    const { data: match, error: matchError } = await serverSupabase
      .from("matches")
      .select(`
        id,
        season_id,
        match_date,
        kickoff_time,
        status,
        minute,
        updated_at,
        source_url,
        home_score,
        away_score,
        round,
        venue,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug ),
        season:season_id (
          id,
          name,
          competition:competition_id ( id, name, slug, region, country_code )
        )
      `)
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !match) throw new Error("Match not found in Supabase");

    const typedMatch = match as unknown as MatchRow;
    const officialSlot=getLnrCalendarData(competitionSlug)?.matches.find(m=>m.id===matchId)||urbaFixture||officialFixture;
    if(officialSlot){typedMatch.match_date=officialSlot.match_date;typedMatch.kickoff_time=officialSlot.kickoff_time;typedMatch.venue=officialSlot.venue||typedMatch.venue;}
    if(urbaFixture)Object.assign(typedMatch,{status:urbaFixture.status,minute:null,home_score:urbaFixture.home_score,away_score:urbaFixture.away_score,source_url:urbaFixture.source_url,updated_at:urbaFixture.updated_at});
    const season = unwrapSeason(typedMatch.season);
    const competition = season?.competition ?? null;
    if (!season || !competition) throw new Error("Competition context missing for match");

    const { data: seasonMatches, error: seasonMatchesError } = await serverSupabase
      .from("matches")
      .select(`
        id,
        season_id,
        match_date,
        kickoff_time,
        status,
        minute,
        updated_at,
        source_url,
        home_score,
        away_score,
        round,
        venue,
        home_team:home_team_id ( id, name, slug ),
        away_team:away_team_id ( id, name, slug )
      `)
      .eq("season_id", season.id)
      .order("match_date", { ascending: true })
      .order("kickoff_time", { ascending: true });

    if (seasonMatchesError) throw seasonMatchesError;

    const recentForm = buildRecentForm((seasonMatches || []) as MatchRow[]);

    const { data: standingsCache, error: standingsError } = await serverSupabase
      .from("standings_cache")
      .select("team_id, position, played, won, drawn, lost, points_for, points_against, points")
      .eq("season_id", season.id)
      .eq("source", "flashscore")
      .order("position", { ascending: true });

    let standings: StandingRow[] = [];
    let standingsSource: "cache" | "unavailable" = "unavailable";

    if (!standingsError && hasUsableStandingCache((standingsCache || []) as StandingCacheRow[]) && hasConsistentStandingsCache((standingsCache || []) as StandingCacheRow[], (row) => ({
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
    }))) {
      const ids = Array.from(
        new Set((standingsCache || []).map((row) => row.team_id).filter((value): value is number => Number.isInteger(value)))
      );
      const { data: teams } = await serverSupabase.from("teams").select("id,name,slug").in("id", ids);
      const teamsById = new Map((teams || []).map((team) => [team.id, team]));

      standings = ((standingsCache || []) as StandingCacheRow[])
        .map((row, index) => {
          const team = row.team_id ? teamsById.get(row.team_id) ?? null : null;
          if (!team) return null;
          return {
            position: row.position ?? index + 1,
            teamId: team.id,
            team: team.name,
            teamSlug: team.slug ?? null,
            pj: row.played ?? 0,
            w: row.won ?? 0,
            d: row.drawn ?? 0,
            l: row.lost ?? 0,
            pf: row.points_for ?? 0,
            pa: row.points_against ?? 0,
            pts: row.points ?? 0,
            badge: null,
            form: recentForm.get(team.id) ?? [],
          } satisfies StandingRow;
        })
        .filter(Boolean) as StandingRow[];
      if(usableCachedStandings((standingsCache||[]) as StandingCacheRow[],teamsById,competition.slug,season.name))standingsSource = "cache";
      else standings=[];
    } else {
      standings = [];
    }

    const homeTeam = unwrapTeam(typedMatch.home_team);
    const awayTeam = unwrapTeam(typedMatch.away_team);
    const reference = historyReference(typedMatch, competition.slug);
    const headToHead = reference ? await getDatabaseHeadToHead(serverSupabase, reference) : null;

    return res.status(200).json(withOfficialStandings({
      competition,
      season: { id: season.id, name: season.name },
      match: {
        ...typedMatch,
        home_team: homeTeam,
        away_team: awayTeam,
      },
      standings,
      standingsSource,
      homeStanding: standings.find((item) => item.teamId === homeTeam?.id) ?? null,
      awayStanding: standings.find((item) => item.teamId === awayTeam?.id) ?? null,
      source: "supabase",
      headToHead,
    }));
  } catch (error) {
    const snapshot = competitionSlug ? getSnapshotMatchDetail(competitionSlug, matchId, refISO) : null;
    if (snapshot) {
      const reference = historyReference(snapshot.match, snapshot.competition.slug);
      return res.status(200).json(withOfficialStandings({ ...snapshot, source: "snapshot", headToHead: reference ? getSnapshotHeadToHead(reference) : null }));
    }

    const fallback = competitionSlug ? getFallbackMatchDetail(competitionSlug, matchId, refISO) : null;
    if (fallback) {
      return res.status(200).json(withOfficialStandings({ ...fallback, source: "fallback", headToHead: null }));
    }

    return res.status(404).json({ error: error instanceof Error ? error.message : "Match not found" });
  }
}
