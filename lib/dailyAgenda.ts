import type { AgendaEvent, AgendaProvider } from "./agenda";
import { getISODateInTimeZone } from "./timeZoneDate";

export type AgendaMatchRow = {
  id: number; match_date: string; kickoff_time: string | null; status: string;
  minute: number | null; home_score: number | null; away_score: number | null;
  updated_at?: string | null; source_url?: string | null;
  home_team: { name: string; slug: string | null } | null;
  away_team: { name: string; slug: string | null } | null;
  season: { competition: { name: string; slug: string; region?: string | null } | null } | null;
};
export type DailyEntry = {
  id: string; matchId?: number; kind: "match" | "show"; date: string; startsAt: string | null;
  home: string; away?: string; homeSlug?: string; awaySlug?: string;
  competition: string; competitionSlug?: string; region: "argentina" | "international";
  status: string; minute: number | null; homeScore: number | null; awayScore: number | null;
  providers: AgendaProvider[]; transmissionPending: boolean; editorial?: AgendaEvent;
  updatedAt?: string | null; sourceUrl?: string | null;
};
export type DailyAgendaData = {
  entries: DailyEntry[]; source: "database" | "snapshot"; checkedAt: string;
  snapshotAt: string; from: string; to: string;
};

export function isAgendaDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function shiftAgendaDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
export function normalizedTeam(value: string) {
  const clean = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ({belgranoathletic:"belgrano",buenosairescrc:"buenosaires",nuevazelanda:"newzealand",atldelrosario:"atleticodelrosario",regatas:"regatasbellavista"} as Record<string,string>)[clean] || clean;
}
const TEAM_SLUGS: Record<string,string> = {
  argentina:"argentina", australia:"australia", nuevazelanda:"new-zealand", newzealand:"new-zealand",
  sic:"sic", cuba:"cuba", newman:"newman", alumni:"alumni", casi:"casi", hindu:"hindu", champagnat:"champagnat",
  lostilos:"los-tilos", laplata:"la-plata", regatasbellavista:"regatas-bella-vista", belgrano:"belgrano",
  losmatreros:"los-matreros", buenosaires:"buenos-aires", atleticodelrosario:"atletico-del-rosario",
  curupayti:"curupayti", lomas:"lomas", pueyrredon:"pueyrredon", sanandres:"san-andres", sanluis:"san-luis",
  universitariolaplata:"universitario-la-plata", jockeysalta:"jockey-club-de-salta",
  northland:"northland", taranaki:"taranaki", cordobaathletic:"cordoba-athletic", tucumanrugby:"tucuman-rugby",
  huirapuca:"huirapuca", cardenalesrc:"cardenales-rc", natacion:"natacion-y-gimnasia", loscuervosrugby:"los-cuervos-uruguay",
  hongkongchinam19:"hong-kong", namibiam19:"namibia", brasilm20:"brazil", canadam20:"canada",
  uruguaym17:"uruguay", chilem20:"chile", belgicam20:"belgium",
  saltam17:"union-salta", cuyom17:"union-cuyo", cordobam17:"union-cordobesa",
  talarc:"tala-rc", lobosrugbyclub:"lobos-uruguay",
};
const pairKey = (home: string, away: string) => `${normalizedTeam(home)}|${normalizedTeam(away)}`;

// Database dates/results win. Editorial TV is matched by teams and the original
// Argentina day, never by competition-wide rights assumptions.
export function buildDailyEntries(rows: AgendaMatchRow[], editorial: AgendaEvent[]): DailyEntry[] {
  const entries: DailyEntry[] = [];
  const consumed = new Set<string>();
  for (const row of rows) {
    const competition = row.season?.competition;
    if (!competition || !row.home_team || !row.away_team || !isAgendaDate(row.match_date)) continue;
    const startsAt = row.kickoff_time ? new Date(`${row.match_date}T${row.kickoff_time.length === 5 ? `${row.kickoff_time}:00` : row.kickoff_time}Z`) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) continue;
    const argentinaDay = startsAt ? getISODateInTimeZone(startsAt, "America/Argentina/Buenos_Aires") : row.match_date;
    const guide = editorial.find(event => {
      if (event.kind !== "match") return false;
      const teams = event.title.split(/\s+vs\s+/i);
      return teams.length === 2 && pairKey(teams[0], teams[1]) === pairKey(row.home_team!.name,row.away_team!.name)
        && getISODateInTimeZone(new Date(event.startsAt), "America/Argentina/Buenos_Aires") === argentinaDay;
    });
    if (guide) consumed.add(guide.id);
    const entry: DailyEntry = {
      id:`match-${row.id}`,matchId:row.id,kind:"match",date:row.match_date,startsAt:startsAt?.toISOString() ?? null,
      home:row.home_team.name,away:row.away_team.name,homeSlug:row.home_team.slug || undefined,awaySlug:row.away_team.slug || undefined,
      competition:competition.name,competitionSlug:competition.slug,
      region:competition.slug.startsWith("ar-") || competition.slug === "sra" || row.home_team.slug === "argentina" || row.away_team.slug === "argentina" ? "argentina" : "international",
      status:row.status,minute:row.minute,homeScore:row.home_score,awayScore:row.away_score,
      providers:guide?.providers || [],transmissionPending:guide?.transmissionPending ?? true,editorial:guide,
      updatedAt:row.updated_at,sourceUrl:row.source_url,
    };
    const duplicate = entries.findIndex(existing => existing.date === entry.date && existing.competitionSlug === entry.competitionSlug && pairKey(existing.home,existing.away || "") === pairKey(entry.home,entry.away || "") && (!existing.startsAt || !entry.startsAt || Math.abs(Date.parse(existing.startsAt)-Date.parse(entry.startsAt))<=3600000));
    if (duplicate < 0) entries.push(entry);
    else if ((entry.updatedAt || "") > (entries[duplicate].updatedAt || "")) entries[duplicate] = entry;
  }
  for (const event of editorial) {
    if (consumed.has(event.id)) continue;
    const teams = event.kind === "match" ? event.title.split(/\s+vs\s+/i) : [event.title];
    entries.push({id:event.id,kind:event.kind,date:event.startsAt.slice(0,10),startsAt:event.startsAt,
      home:teams[0],away:teams[1],homeSlug:TEAM_SLUGS[normalizedTeam(teams[0])],awaySlug:teams[1] ? TEAM_SLUGS[normalizedTeam(teams[1])] : undefined,
      competition:event.competition,competitionSlug:event.competition.startsWith("URBA Top 14") ? "ar-urba-top14" : undefined,
      region:event.region === "international" ? "international" : "argentina",status:"unknown",minute:null,homeScore:null,awayScore:null,
      providers:event.providers,transmissionPending:event.transmissionPending,editorial:event});
  }
  return entries.sort((a,b) => (a.startsAt || `${a.date}T23:59`).localeCompare(b.startsAt || `${b.date}T23:59`) || a.home.localeCompare(b.home));
}
export function dailyEntryDate(entry: DailyEntry, timeZone: string) {
  return entry.startsAt ? getISODateInTimeZone(new Date(entry.startsAt),timeZone) : entry.date;
}
export function dailyEntryState(entry: DailyEntry, now: number) {
  if (entry.status === "FT" || entry.status === "CANC" || entry.status === "LIVE" || entry.status === "HT") return entry.status;
  if (entry.startsAt && Date.parse(entry.startsAt) < now) return "pending";
  return "NS";
}
export function agendaPriority(entry: DailyEntry) {
  if (entry.homeSlug === "argentina" || entry.awaySlug === "argentina") return 0;
  if (entry.competitionSlug === "ar-urba-top14") return 1;
  return entry.region === "argentina" ? 2 : 3;
}
