import assert from "node:assert/strict";
import test from "node:test";
import { dateFitsSeason, inferMatchDateFromRawText, inferMatchDateFromScrapedRow, seasonYearBounds, selectSeasonForScrapedRow } from "../lib/scrapedMatchDate";

test("preserves the explicit World Cup year instead of using the current season", () => {
  assert.equal(inferMatchDateFromRawText("17.10.2027 19:45", "2025/2026"), "2027-10-17");
  assert.equal(inferMatchDateFromRawText("Oct 17, 2027", "Current"), "2027-10-17");
  assert.equal(inferMatchDateFromRawText("2027-10-17", "2026"), "2027-10-17");
  assert.equal(inferMatchDateFromRawText("17 October 2027", "2026"), "2027-10-17");
});

test("prefers a complete date over a preceding yearless label", () => {
  assert.equal(inferMatchDateFromScrapedRow({ statusOrTime: "17.10. 19:45", rawText: "France Samoa", dateLabel: "17.10.2027", sectionText: "" }, "2026"), "2027-10-17");
  assert.equal(inferMatchDateFromScrapedRow({ statusOrTime: "17.10. 19:45", rawText: "France Samoa", dateLabel: "", sectionText: "", sourceSeasonName: "2027" }, "2026"), "2027-10-17");
});

test("handles split seasons without assigning an arbitrary year to Current", () => {
  assert.equal(inferMatchDateFromRawText("04.10.", "2026/27"), "2026-10-04");
  assert.equal(inferMatchDateFromRawText("04.03.", "2026/27"), "2027-03-04");
  assert.equal(inferMatchDateFromRawText("04.10.", "Current"), null);
  assert.deepEqual(seasonYearBounds("1999/00"), { startYear: 1999, endYear: 2000 });
});

test("rejects impossible calendar dates and knockout labels", () => {
  assert.equal(inferMatchDateFromRawText("31.02.2027", "2027"), null);
  assert.equal(inferMatchDateFromRawText("29.02.2027", "2027"), null);
  assert.equal(inferMatchDateFromRawText("29.02.2028", "2028"), "2028-02-29");
  assert.equal(inferMatchDateFromRawText("1/8 de final", "2027"), null);
  assert.equal(inferMatchDateFromRawText("2/14", "2027"), "2027-02-14");
});

test("never treats an explicit date in another edition as belonging to the selected season", () => {
  assert.equal(dateFitsSeason("2027-10-17", "2025/2026"), false);
  assert.equal(dateFitsSeason("2027-10-17", "2027"), true);
  assert.equal(dateFitsSeason("2027-03-04", "2026/27"), true);
  assert.equal(dateFitsSeason("2027-10-17", "Current"), false);
});

test("keeps historical results and future fixtures in separate seasons", () => {
  const seasons = [{ id: 1, name: "2023" }, { id: 2, name: "2025/2026" }, { id: 3, name: "2027" }];
  const row = { statusOrTime: "17.10.", rawText: "France Samoa", dateLabel: "", sectionText: "" };
  assert.equal(selectSeasonForScrapedRow(seasons, { ...row, sourceSeasonName: "2027" })?.id, 3);
  assert.equal(selectSeasonForScrapedRow(seasons, { ...row, dateLabel: "17.10.2023" })?.id, 1);
  assert.equal(selectSeasonForScrapedRow(seasons, row), null);
  assert.equal(selectSeasonForScrapedRow(seasons, { ...row, sourceSeasonName: "2027", dateLabel: "17.10.2023" }), null);
  assert.equal(selectSeasonForScrapedRow([{id: 4, name: "2026"}], row)?.id, 4);
});

test("does not roll archived relative or yearless dates onto today's calendar", () => {
  const row = { statusOrTime: "Today 19:45", rawText: "France Samoa", dateLabel: "", sectionText: "" };
  assert.equal(inferMatchDateFromScrapedRow(row, "Current", new Date("2026-10-19T12:00:00Z"), false), null);
  assert.equal(inferMatchDateFromScrapedRow({ ...row, statusOrTime: "17.10." }, "Current", new Date(), false), null);
  assert.equal(inferMatchDateFromScrapedRow({ ...row, statusOrTime: "17.10.2025" }, "Current", new Date(), false), "2025-10-17");
});
