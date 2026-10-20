import assert from "node:assert/strict";
import test from "node:test";
import { competitionSlugFromFlashscoreUrl } from "../lib/flashscoreCompetition";
import { applyProD2TeamAliases, canonicalProD2TeamName, getProD2Team, PRO_D2_COMPETITION, PRO_D2_TEAMS } from "../lib/proD2";
import { sourceTeamName } from "../lib/sourceTeamIdentity";
import { inferMatchDateFromScrapedRow, selectSeasonForScrapedRow } from "../lib/scrapedMatchDate";
import { getCompetitionCountryKey, getCompetitionSortPriority, isEuropeCompetition } from "../lib/competitionPrefs";
import { validateResolvedStandingsTeamIds, validateSourceStandings } from "../lib/sourceStandings";

test("Pro D2 URL is French and stays distinct from either Top 14", () => {
  assert.equal(competitionSlugFromFlashscoreUrl(PRO_D2_COMPETITION.flashscoreUrl), "fr-pro-d2");
  assert.equal(competitionSlugFromFlashscoreUrl("https://www.flashscore.fr/rugby/france/pro-d2/classement/"), "fr-pro-d2");
  assert.equal(competitionSlugFromFlashscoreUrl("https://www.flashscore.com/rugby-union/argentina/pro-d2/"), null);
  assert.equal(competitionSlugFromFlashscoreUrl("https://www.flashscore.com/rugby-union/france/top-14/"), "fr-top14");
  assert.equal(competitionSlugFromFlashscoreUrl("https://www.flashscore.com/rugby-union/argentina/top-14/"), "ar-urba-top14");
});

test("all sixteen official Pro D2 clubs have unique exact identities", () => {
  assert.equal(PRO_D2_TEAMS.length, 16);
  assert.equal(new Set(PRO_D2_TEAMS.map((team) => team.slug)).size, 16);
  for (const team of PRO_D2_TEAMS) assert.equal(getProD2Team(team.officialName)?.slug, team.slug);
  assert.equal(canonicalProD2TeamName("AS Béziers Hérault"), "Beziers");
  assert.equal(canonicalProD2TeamName("Nissa Rugby"), "Nice");
  assert.equal(getProD2Team("Montpellier Hérault Rugby"), null);
  assert.equal(getProD2Team("Lyon"), null);
  const teams = new Map([[sourceTeamName("Montauban"), 54], [sourceTeamName("Agen"), 500]]);
  applyProD2TeamAliases(teams);
  assert.equal(teams.get(sourceTeamName("US Montauban")), 54);
  assert.equal(teams.get(sourceTeamName("SU Agen")), 500);
  assert.equal(teams.get(sourceTeamName("Montpellier")), undefined);
});

test("all actual Flashscore names resolve to the same sixteen LNR club identities", () => {
  // Verified names in the 168-row source dry run, GitHub Actions 39371132747.
  const sourceNames = [
    ["Agen", "agen"], ["Angouleme", "soyaux-angouleme"], ["Aurillac", "aurillac"],
    ["Beziers", "beziers"], ["Biarritz Olympique", "biarritz"], ["CA Brive", "brive"],
    ["Colomiers", "colomiers"], ["Grenoble FC", "grenoble"], ["Montauban", "montauban"],
    ["Narbonne", "narbonne"], ["Nevers", "nevers"], ["Nissa", "nice"],
    ["Provence Rugby", "provence-rugby"], ["US Dax", "dax"], ["US Oyonnax", "oyonnax"],
    ["Valence Romans", "valence-romans"],
  ];
  for (const [name, slug] of sourceNames) assert.equal(getProD2Team(name)?.slug, slug, name);
  assert.equal(new Set(sourceNames.map(([name]) => getProD2Team(name)?.slug)).size, 16);
});

test("Pro D2 edition separates autumn 2026 and spring 2027 from previous results", () => {
  const seasons = [{ id: 1, name: "2025/2026" }, { id: 2, name: PRO_D2_COMPETITION.season_name }];
  const row = { statusOrTime: "23.10. 19:30", rawText: "Agen Nice", dateLabel: "", sectionText: "", sourceSeasonName: "2026/2027" };
  assert.equal(selectSeasonForScrapedRow(seasons, row)?.id, 2);
  assert.equal(inferMatchDateFromScrapedRow(row, seasons[1].name), "2026-10-23");
  assert.equal(inferMatchDateFromScrapedRow({ ...row, statusOrTime: "05.03. 19:30" }, seasons[1].name), "2027-03-05");
  assert.equal(selectSeasonForScrapedRow(seasons, { ...row, dateLabel: "23.10.2025" }), null);
  assert.equal(getCompetitionCountryKey(PRO_D2_COMPETITION), "france");
  assert.equal(isEuropeCompetition(PRO_D2_COMPETITION.slug), true);
  assert.ok(getCompetitionSortPriority(PRO_D2_COMPETITION) > getCompetitionSortPriority({slug: "fr-top14"}));
});

test("a partial Pro D2 table cannot replace all sixteen clubs", () => {
  const rows = PRO_D2_TEAMS.map((team, index) => ({ pos: index + 1, team: team.name, played: 7, won: 3, drawn: 0, lost: 4, pointsFor: 130, pointsAgainst: 140, points: 14 }));
  assert.doesNotThrow(() => validateSourceStandings(rows, 16));
  assert.throws(() => validateSourceStandings(rows.slice(0, 14), 16), /Expected 16/);
});

test("Pro D2 refuses a partial write after missing or coalesced team identities", () => {
  const teamIds = Array.from({length: 16}, (_, index) => index + 1);
  assert.doesNotThrow(() => validateResolvedStandingsTeamIds(teamIds, 16));
  assert.throws(() => validateResolvedStandingsTeamIds(teamIds.slice(0, 15), 16), /Expected 16 resolved/);
  assert.throws(() => validateResolvedStandingsTeamIds([...teamIds.slice(0, 15), null], 16), /unresolved/);
  assert.throws(() => validateResolvedStandingsTeamIds([...teamIds.slice(0, 15), 1], 16), /duplicate resolved/);
  // The importer's Map coalesces aliases before forming the write payload.
  const coalescedPayloadIds = [...new Set([...teamIds.slice(0, 15), 1])];
  assert.throws(() => validateResolvedStandingsTeamIds(coalescedPayloadIds, 16), /Expected 16 resolved/);
});
