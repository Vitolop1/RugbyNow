import assert from "node:assert/strict";
import test from "node:test";
import { AGENDA_SOURCE, EDITORIAL_AGENDA } from "../data/rugbyAgenda";
import { agendaCalendar, agendaDate, filterAgenda } from "../lib/agenda";

test("editorial events have unique IDs and immutable dates inside their source window", () => {
  assert.equal(new Set(EDITORIAL_AGENDA.map((event) => event.id)).size, EDITORIAL_AGENDA.length);
  for (const event of EDITORIAL_AGENDA) {
    const date = agendaDate(event, AGENDA_SOURCE.timeZone);
    assert.ok(date >= AGENDA_SOURCE.from && date <= AGENDA_SOURCE.to);
    assert.equal(event.sourceDate, AGENDA_SOURCE.date);
    assert.ok(event.providers.length);
    for (const provider of event.providers) if (provider.href) assert.equal(new URL(provider.href).protocol, "https:");
  }
});

test("search ignores accents and can find a broadcaster, while filters combine", () => {
  const argentina = AGENDA_SOURCE.timeZone;
  const query = filterAgenda(EDITORIAL_AGENDA, { query: "tucuman", kind: "show", date: "2026-10-20", timeZone: argentina });
  assert.equal(query.length, 2);
  assert.ok(query.every((event) => event.kind === "show"));
  assert.equal(filterAgenda(EDITORIAL_AGENDA, {kind:"match", region:"buenos-aires", timeZone:argentina}).length, 10);
  const saved = new Set([EDITORIAL_AGENDA[0].id]);
  assert.equal(filterAgenda(EDITORIAL_AGENDA, {saved, timeZone:argentina}).length, 1);
});

test("an early Argentina fixture moves to the previous day in Los Angeles", () => {
  const event = EDITORIAL_AGENDA.find((item) => item.title === "Australia vs Nueva Zelanda")!;
  assert.equal(agendaDate(event, "America/Argentina/Buenos_Aires"), "2026-10-17");
  assert.equal(agendaDate(event, "America/New_York"), "2026-10-17");
  assert.equal(agendaDate(event, "America/Los_Angeles"), "2026-10-16");
});

test("calendar exports preserve the exact UTC start, escape text and fold UTF-8 lines", () => {
  const event = { ...EDITORIAL_AGENDA[0], title: "Rugby, amigos; miércoles\n" + "á".repeat(90) };
  const calendar = agendaCalendar(event, "https://rugby-now.com/agenda", new Date("2026-10-19T12:00:00Z"));
  const unfolded = calendar.replace(/\r\n /g, "");
  assert.ok(unfolded.includes("DTSTART:20261016T060500Z"));
  assert.ok(unfolded.includes("SUMMARY:Rugby\\, amigos\\; miércoles\\n"));
  assert.ok(calendar.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75));
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
});
