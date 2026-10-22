import type {AgendaEvent, AgendaProvider} from "./agenda";
import type {ConfirmedMatchBroadcast, MatchBroadcastQuery} from "./matchBroadcasts";
import {getBroadcastProvider} from "./broadcasts";
import {getProD2Team} from "./proD2";
import {getTop14Team} from "./top14Identity";
import {normalizedTeam, type DailyEntry} from "./dailyAgenda";
import {EDITORIAL_AGENDA} from "../data/rugbyAgenda";
import stored from "../data/match-broadcasts.json";

export type InternationalBroadcastQuery = Omit<MatchBroadcastQuery, "country"> & {season?: string | null};
export type BroadcastEvidence = {
  country: string; sourceName: string; sourceUrl?: string; checkedAt: string;
  dateKind: "checked" | "published"; season?: string;
  href?: string; linkType?: AgendaProvider["linkType"];
};
export type InternationalBroadcaster = {id: string; name: string; countries: string[]; evidence: BroadcastEvidence[]};
type IndexedBroadcast = {edition: string; provider: AgendaProvider; evidence: BroadcastEvidence};

/** A search result is never a verified channel/event destination. */
export function safeBroadcastHref(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return undefined;
    if (/^(?:www\.)?(?:google\.[a-z.]+|bing\.com|search\.yahoo\.com)$/.test(url.hostname)
      || /\/(?:search|results)\/?$/.test(url.pathname)) return undefined;
    return url.href;
  } catch { return undefined; }
}

function edition(value?: string | null) {
  const match = value?.trim().match(/^(\d{4})(?:[-/](\d{4}))?$/);
  if (!match || (match[2] && Number(match[2]) !== Number(match[1]) + 1)) return null;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}
function identity(name: string, competition: string) {
  if (competition === "fr-pro-d2") return getProD2Team(name)?.slug ?? null;
  if (competition === "fr-top14") return getTop14Team(name)?.slug ?? null;
  // Exact normalized text only: never substring-match similarly named clubs.
  return normalizedTeam(name) || null;
}
function key(query: InternationalBroadcastQuery) {
  if (!query.competitionSlug || !query.home || !query.away || !query.startsAt) return null;
  if (!/T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/i.test(query.startsAt)) return null;
  const kickoff = Date.parse(query.startsAt);
  const home = identity(query.home, query.competitionSlug), away = identity(query.away, query.competitionSlug);
  return Number.isFinite(kickoff) && home && away && home !== away
    ? JSON.stringify([query.competitionSlug, home, away, kickoff]) : null;
}
export function editorialBroadcastCompetition(event: AgendaEvent) {
  // Only URBA Top 14 has an explicitly matched catalogue identity in this guide.
  return event.competition.startsWith("URBA Top 14 ·") ? "ar-urba-top14" : `editorial:${event.competition}`;
}
export function dailyBroadcastQuery(entry: DailyEntry): InternationalBroadcastQuery {
  return {competitionSlug: entry.competitionSlug || (entry.editorial ? editorialBroadcastCompetition(entry.editorial) : undefined),
    home: entry.home, away: entry.away, startsAt: entry.startsAt, season: entry.season};
}

/** Build once, then perform exact fixture lookups without rescanning the catalogue per row. */
export function createInternationalBroadcastIndex(listings: readonly ConfirmedMatchBroadcast[], editorial: readonly AgendaEvent[] = []) {
  const index = new Map<string, IndexedBroadcast[]>();
  function add(query: InternationalBroadcastQuery, item: IndexedBroadcast) {
    const fixture = key(query);
    if (!fixture) return;
    const bucket = index.get(fixture) || [];
    bucket.push(item); index.set(fixture, bucket);
  }
  for (const listing of listings) {
    const season = edition(listing.season), sourceUrl = safeBroadcastHref(listing.sourceUrl);
    if (!season || !sourceUrl || !listing.sourceName.trim() || !/^[A-Z]{2}$/.test(listing.country)
      || !Number.isFinite(Date.parse(listing.checkedAt))) continue;
    for (const id of listing.providerIds) {
      const provider = getBroadcastProvider(id);
      if (!provider) continue;
      add(listing, {edition: season, provider: {id, name: provider.label}, evidence: {
        country: listing.country, sourceName: listing.sourceName, sourceUrl, checkedAt: listing.checkedAt,
        dateKind: "checked", season, href: safeBroadcastHref(provider.href), linkType: "platform",
      }});
    }
  }
  for (const event of editorial) {
    if (event.kind !== "match" || event.transmissionPending || !event.source.trim()
      || !Number.isFinite(Date.parse(event.sourceDate))) continue;
    const teams = event.title.split(/\s+vs\s+/i);
    if (teams.length !== 2) continue;
    const competitionSlug = editorialBroadcastCompetition(event);
    // This bounded Argentine guide publishes a calendar-year URBA edition.
    // Other competitions keep their guide scope; they do not acquire guessed season IDs.
    const season = competitionSlug === "ar-urba-top14" ? event.startsAt.slice(0,4) : undefined;
    for (const provider of event.providers) add({competitionSlug, home: teams[0], away: teams[1], startsAt: event.startsAt}, {
      edition: season || `guide:${event.sourceDate}`, provider,
      evidence: {country: "AR", sourceName: event.source, checkedAt: event.sourceDate, dateKind: "published", season,
        href: safeBroadcastHref(provider.href), linkType: provider.linkType},
    });
  }

  return (query: InternationalBroadcastQuery): InternationalBroadcaster[] => {
    const fixture = key(query);
    if (!fixture) return [];
    const requested = query.season ? edition(query.season) : null;
    if (query.season && !requested) return [];
    const bucket = (index.get(fixture) || []).filter(item => !requested || item.edition === requested);
    // Conflicting source editions require resolution, never an arbitrary merge.
    if (new Set(bucket.map(item => item.edition)).size > 1) return [];
    const groups = new Map<string, InternationalBroadcaster>();
    for (const item of bucket) {
      let group = groups.get(item.provider.id);
      if (!group) {group = {id: item.provider.id, name: item.provider.name, countries: [], evidence: []}; groups.set(group.id, group);}
      if (!group.countries.includes(item.evidence.country)) group.countries.push(item.evidence.country);
      if (!group.evidence.some(e => JSON.stringify(e) === JSON.stringify(item.evidence))) group.evidence.push({...item.evidence});
    }
    for (const group of groups.values()) {
      group.countries.sort();
      group.evidence.sort((a,b) => a.country.localeCompare(b.country) || b.checkedAt.localeCompare(a.checkedAt));
    }
    return [...groups.values()].sort((a,b) => a.id.localeCompare(b.id));
  };
}

export const getInternationalMatchBroadcasts = createInternationalBroadcastIndex(stored.listings as ConfirmedMatchBroadcast[], EDITORIAL_AGENDA);
