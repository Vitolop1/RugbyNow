import assert from "node:assert/strict";
import test from "node:test";
import { buildHeadToHead, type HeadToHeadCandidate, type HeadToHeadReference } from "../lib/headToHead";
import { getSnapshotHeadToHead } from "../lib/headToHeadServer";
import snapshot from "../data/supabase-snapshot.json";

const a = { id: 1, name: "Club A", slug: "club-a" };
const b = { id: 2, name: "Club B", slug: "club-b" };
const reference: HeadToHeadReference = { id: 99, matchDate: "2026-10-20", kickoffTime: "15:00:00", homeTeam: a, awayTeam: b, competitionSlug: "fr-top14" };
const now = Date.parse("2026-10-20T20:00:00Z");
function result(id: number, day: number, homeTeam = a, awayTeam = b, homeScore = 30, awayScore = 20): HeadToHeadCandidate {
  return { id, matchDate: `2026-10-${String(day).padStart(2, "0")}`, kickoffTime: "15:00:00", status: "FT",
    homeTeam, awayTeam, homeScore, awayScore, competition: { name: "Top 14", slug: "fr-top14" } };
}

test("head-to-head selects both home/away orientations by exact IDs, newest first, at most five", () => {
  const rows = [result(1, 19), result(2, 18, b, a, 10, 25), result(3, 17, a, b, 0, 0),
    result(4, 16, b, a, 25, 20), result(5, 15, a, b, 10, 20), result(6, 14),
    result(7, 19, { ...a, id: 3 }), { ...result(8, 19), status: "LIVE" },
    { ...result(9, 19), homeScore: null }, { ...result(12, 19), homeTeam: null }, result(99, 20), result(10, 21),
    { ...result(11, 19), competition: { name: "SVNS", slug: "svns-hong-kong" } }];
  const data = buildHeadToHead(reference, rows, "supabase", now)!;
  assert.deepEqual(data.matches.map(row => row.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(data.summary, { homeWins: 2, draws: 1, awayWins: 2 });
  assert.equal(data.coverage, "partial");
  assert.equal(data.matches[1].homeTeam.id, b.id);
});

test("history excludes future and ambiguous same-day fixtures and does not double-count duplicate imports", () => {
  const early = { ...result(1, 20), kickoffTime: "10:00:00" };
  const data = buildHeadToHead(reference, [early, { ...early, id: 2 },
    { ...result(3, 20), kickoffTime: "16:00:00" }, { ...result(4, 20), kickoffTime: null },
    { ...result(5, 19), kickoffTime: "24:00:00" }, { ...result(6, 19), matchDate: "2026-13-19" }], "snapshot", now)!;
  assert.equal(data.matches.length, 1);
  assert.equal(data.matches[0].startsAt, "2026-10-20T10:00:00.000Z");
  assert.equal(buildHeadToHead({ ...reference, kickoffTime: null }, [early], "snapshot", now)?.matches.length, 0);
  assert.equal(buildHeadToHead({ ...reference, matchDate: "2026-10-25" }, [result(7, 22)], "snapshot", now)?.matches.length, 0);
  assert.equal(buildHeadToHead({ ...reference, matchDate: "2026-99-25" }, [], "snapshot", now), null);
});

test("snapshot history preserves real identities and refuses curated IDs that collide with database IDs", () => {
  assert.equal(getSnapshotHeadToHead(reference), null);
  const target = snapshot.matches.find(row => row.id === 16248)!;
  const home = snapshot.teams.find(team => team.id === target.home_team_id)!;
  const away = snapshot.teams.find(team => team.id === target.away_team_id)!;
  const season = snapshot.seasons.find(item => item.id === target.season_id)!;
  const competition = snapshot.competitions.find(item => item.id === season.competition_id)!;
  const data = getSnapshotHeadToHead({ id: target.id, matchDate: target.match_date, kickoffTime: target.kickoff_time,
    homeTeam: home, awayTeam: away, competitionSlug: competition.slug })!;
  assert.ok(data.matches.length > 0);
  assert.equal(data.source, "snapshot");
  assert.ok(data.matches.every(row => row.id !== target.id && row.matchDate <= target.match_date));
  assert.deepEqual(new Set(data.matches.flatMap(row => [row.homeTeam.id, row.awayTeam.id])), new Set([home.id, away.id]));
});
