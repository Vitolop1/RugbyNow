export type AgendaRegion = "buenos-aires" | "argentina" | "international";
export type AgendaProvider = { id: string; name: string; href?: string; linkType?: "channel" | "platform" | "event" };
export type AgendaEvent = {
  id: string;
  title: string;
  competition: string;
  kind: "match" | "show";
  region: AgendaRegion;
  startsAt: string;
  providers: AgendaProvider[];
  source: string;
  sourceDate: string;
  transmissionPending: boolean;
  score?: string;
};

export function agendaDate(event: AgendaEvent, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(event.startsAt));
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)?.value).join("-");
}

export function filterAgenda(events: AgendaEvent[], filters: { date?: string; query?: string; kind?: string; region?: string; saved?: Set<string>; timeZone: string }) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = normalize(filters.query || "").trim();
  return events.filter((event) => {
    if (filters.date && agendaDate(event, filters.timeZone) !== filters.date) return false;
    if (filters.kind && filters.kind !== "all" && event.kind !== filters.kind) return false;
    if (filters.region && filters.region !== "all" && event.region !== filters.region) return false;
    if (filters.saved && !filters.saved.has(event.id)) return false;
    return !query || normalize([event.title, event.competition, ...event.providers.map((provider) => provider.name)].join(" ")).includes(query);
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title));
}

function escapeCalendar(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function agendaCalendar(event: AgendaEvent, url: string, now = new Date()) {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rugby Now//Agenda//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${event.id}@rugby-now.com`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(new Date(event.startsAt))}`,
    `SUMMARY:${escapeCalendar(event.title)}`, `DESCRIPTION:${escapeCalendar(`${event.competition}\n${event.source}\n${url}`)}`, `URL:${url}`, "END:VEVENT", "END:VCALENDAR"];
  // Fold by UTF-8 bytes without splitting a code point (RFC 5545).
  return lines.flatMap((line) => {
    const folded: string[] = [];
    let current = "";
    let size = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (size + bytes > 75) { folded.push(current); current = " "; size = 1; }
      current += char;
      size += bytes;
    }
    folded.push(current);
    return folded;
  }).join("\r\n") + "\r\n";
}
