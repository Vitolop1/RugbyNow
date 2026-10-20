import type { AgendaProvider } from "./agenda";
import { getBroadcastLogo, getBroadcastProvider, type BroadcastProviderId } from "./broadcasts";
import { getProD2Team } from "./proD2";
import { normalizedTeam } from "./dailyAgenda";
import { EDITORIAL_AGENDA } from "../data/rugbyAgenda";
import stored from "../data/match-broadcasts.json";

export type ConfirmedMatchBroadcast = {
  id: string;
  competitionSlug: string;
  season: string;
  home: string;
  away: string;
  startsAt: string;
  country: string;
  providerIds: BroadcastProviderId[];
  sourceName: string;
  sourceUrl: string;
  checkedAt: string;
};

export type MatchBroadcastQuery = {
  competitionSlug?: string | null;
  home?: string | null;
  away?: string | null;
  startsAt?: string | null;
  country: string;
};

function teamIdentity(name: string, competition: string): string | null {
  // The explicit Pro D2 roster handles source aliases without substring matches.
  if (competition === "fr-pro-d2") return getProD2Team(name)?.slug ?? null;
  return null;
}

export function getConfirmedMatchBroadcasts(
  query: MatchBroadcastQuery,
  listings: readonly ConfirmedMatchBroadcast[] = stored.listings as ConfirmedMatchBroadcast[],
): { providers: AgendaProvider[]; sourceName: string; sourceUrl: string; checkedAt: string } | null {
  if (!query.competitionSlug || !query.home || !query.away || !query.startsAt) return null;
  const kickoff = Date.parse(query.startsAt);
  if (!Number.isFinite(kickoff)) return null;
  const home = teamIdentity(query.home, query.competitionSlug);
  const away = teamIdentity(query.away, query.competitionSlug);
  if (!home || !away) return null;
  const listing = listings.find(item => item.competitionSlug === query.competitionSlug
    && item.country === query.country.toUpperCase()
    && Date.parse(item.startsAt) === kickoff
    && teamIdentity(item.home, item.competitionSlug) === home
    && teamIdentity(item.away, item.competitionSlug) === away);
  if (!listing) return null;
  const providers = listing.providerIds.flatMap(id => {
    const provider = getBroadcastProvider(id);
    return provider ? [{ id, name: provider.label, href: provider.href, linkType: "platform" as const }] : [];
  });
  providers.sort((a, b) => Number(Boolean(getBroadcastLogo(b.id))) - Number(Boolean(getBroadcastLogo(a.id))));
  if (!providers.length) return null;
  return { providers, sourceName: listing.sourceName, sourceUrl: listing.sourceUrl, checkedAt: listing.checkedAt };
}

export type MatchTelevision = {
  providers: AgendaProvider[];
  pending: boolean;
  sourceName: string;
  sourceUrl?: string;
  checkedAt: string;
};

export function getMatchTelevision(query: MatchBroadcastQuery): MatchTelevision | null {
  const official = getConfirmedMatchBroadcasts(query);
  if (official) return { ...official, pending: false };
  if (query.country.toUpperCase() !== "AR" || !query.home || !query.away || !query.startsAt) return null;
  const kickoff = Date.parse(query.startsAt);
  if (!Number.isFinite(kickoff)) return null;
  const event = EDITORIAL_AGENDA.find(item => {
    if (item.kind !== "match" || Date.parse(item.startsAt) !== kickoff) return false;
    const teams = item.title.split(/\s+vs\s+/i);
    return teams.length === 2 && normalizedTeam(teams[0]) === normalizedTeam(query.home!)
      && normalizedTeam(teams[1]) === normalizedTeam(query.away!);
  });
  if (!event) return null;
  return { providers: event.providers, pending: event.transmissionPending,
    sourceName: event.source,
    // The image guide supplies a publication date, not a live verification time.
    checkedAt: event.sourceDate };
}
