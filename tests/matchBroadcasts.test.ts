import assert from "node:assert/strict";
import test from "node:test";
import { getConfirmedMatchBroadcasts, getMatchTelevision, type ConfirmedMatchBroadcast } from "../lib/matchBroadcasts";
import { parseLnrProD2Broadcasts } from "../lib/lnrBroadcasts";
import { getBroadcastLogo } from "../lib/broadcasts";

const first: ConfirmedMatchBroadcast = { id: "lnr-12068-fr", competitionSlug: "fr-pro-d2", season: "2026-2027",
  home: "Montauban", away: "Oyonnax", startsAt: "2026-10-22T19:00:00.000Z", country: "FR",
  providerIds: ["canal-plus-sport"], sourceName: "Ligue Nationale de Rugby",
  sourceUrl: "https://prod2.lnr.fr/feuille-de-match/2026-2027/j8/12068-montauban-oyonnax", checkedAt: "2026-10-20T12:00:00.000Z" };

test("TV confirmation requires the exact fixture, kickoff and viewing country", () => {
  const query = { competitionSlug: "fr-pro-d2", home: "US Montauban", away: "Oyonnax Rugby", startsAt: "2026-10-22T21:00:00+02:00", country: "FR" };
  assert.equal(getConfirmedMatchBroadcasts(query, [first])?.providers[0].name, "CANAL+ SPORT");
  assert.equal(getConfirmedMatchBroadcasts({ ...query, country: "AR" }, [first]), null);
  assert.equal(getConfirmedMatchBroadcasts({ ...query, startsAt: "2026-10-23T19:00:00Z" }, [first]), null);
  assert.equal(getConfirmedMatchBroadcasts({ ...query, home: "Oyonnax", away: "Montauban" }, [first]), null);
  assert.equal(getConfirmedMatchBroadcasts({ ...query, competitionSlug: "fr-top14" }, [first]), null);
  assert.equal(getConfirmedMatchBroadcasts({ ...query, home: "Montauban reserves" }, [first]), null);
  assert.equal(getConfirmedMatchBroadcasts({ ...query, startsAt: undefined }, [first]), null);
});

const teams = [["US Montauban", "Oyonnax Rugby"], ["RC Narbonnais", "CA Brive"], ["SU Agen", "Nissa Rugby"],
  ["Soyaux-Angoulême XV", "US Dax"], ["Stade Aurillacois", "USON Nevers"], ["Valence Romans", "Colomiers Rugby"],
  ["Provence Rugby", "AS Béziers Hérault"], ["FC Grenoble Rugby", "Biarritz Olympique PB"]];
const round = teams.map(([home, away], i) => ({ id: 12068 + i, hosting_club: { name: home }, visiting_club: { name: away },
  broadcasters: [{ name: "Canal + Sport" }], link: `https://prod2.lnr.fr/feuille-de-match/2026-2027/j8/${12068 + i}-match`,
  timer: { firstPeriodStartDate: "2026-10-22T21:00:00+02:00" }, is_postponed: false }));
const html = (data: unknown) => `<score-slider :matches='${JSON.stringify(data)}'></score-slider>`;

test("LNR TV parser keeps source edition and timezone and rejects incomplete or mixed rounds", () => {
  const parsed = parseLnrProD2Broadcasts(html(round), first.checkedAt);
  assert.equal(parsed.length, 8);
  assert.equal(parsed[0].startsAt, first.startsAt);
  assert.equal(parsed[0].season, "2026-2027");
  assert.equal(parsed[0].country, "FR");
  assert.throws(() => parseLnrProD2Broadcasts(html(round.slice(0, 7)), first.checkedAt));
  assert.throws(() => parseLnrProD2Broadcasts(html([{ ...round[0], link: round[0].link.replace("2026-2027", "2025-2026") }, ...round.slice(1)]), first.checkedAt));
  assert.throws(() => parseLnrProD2Broadcasts(html([{ ...round[0], link: round[0].link.replace("j8", "j9") }, ...round.slice(1)]), first.checkedAt));
  assert.throws(() => parseLnrProD2Broadcasts(html([{ ...round[0], broadcasters: [{ name: "Rugbyrama" }] }, ...round.slice(1)]), first.checkedAt));
  assert.throws(() => parseLnrProD2Broadcasts(html([{ ...round[0], timer: { firstPeriodStartDate: "2026-10-22T21:00:00" } }, ...round.slice(1)]), first.checkedAt));
  assert.equal(parseLnrProD2Broadcasts(html([{ ...round[0], is_postponed: true }, ...round.slice(1)]), first.checkedAt).length, 7);
});

test("only known broadcaster IDs resolve to local logos", () => {
  assert.equal(getBroadcastLogo("canal-plus-sport"), "/broadcast-logos/canal-plus-sport.png");
  assert.equal(getBroadcastLogo("disney-plus"), "/broadcast-logos/disney-plus.png");
  assert.equal(getBroadcastLogo("rugbyrama"), undefined);
});

test("the Argentina image guide is tied to exact teams and kickoff and never rolls into another week", () => {
  const query = { competitionSlug: "ar-urba-top14", home: "SIC", away: "Buenos Aires", startsAt: "2026-10-17T18:30:00Z", country: "AR" };
  const guide = getMatchTelevision(query);
  assert.equal(guide?.providers[0].id, "disney-plus");
  assert.equal(guide?.pending, false);
  assert.equal(guide?.sourceName, "Norte Rugby · Horacio Cortez");
  assert.equal(guide?.checkedAt, "2026-10-15");
  assert.equal(getMatchTelevision({ ...query, startsAt: "2026-10-24T18:30:00Z" }), null);
  assert.equal(getMatchTelevision({ ...query, country: "FR" }), null);
  assert.equal(getMatchTelevision({ ...query, startsAt: "2026-10-17T19:30:00Z" }), null);
});
