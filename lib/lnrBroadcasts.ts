import { getProD2Team } from "./proD2";
import type { BroadcastProviderId } from "./broadcasts";
import type { ConfirmedMatchBroadcast } from "./matchBroadcasts";

const LNR_CHANNELS: Record<string, BroadcastProviderId> = {
  "Canal + Sport": "canal-plus-sport",
  "Canal + Sport 360": "canal-plus-sport-360",
  "Canal + Live": "canal-plus-live",
  "Sport +": "canal-sport-plus",
};

type LnrMatch = {
  id: number;
  hosting_club: { name: string };
  visiting_club: { name: string };
  broadcasters?: { name: string }[];
  link: string;
  timer?: { firstPeriodStartDate?: string | null };
  is_postponed?: boolean;
};

// This is the public match payload used by LNR's score slider. Its explicit
// timezone, edition and per-match channels avoid guessing from rights alone.
export function parseLnrProD2Broadcasts(html: string, checkedAt: string): ConfirmedMatchBroadcast[] {
  const encoded = html.match(/:matches='([^']+)'/);
  if (!encoded) throw new Error("LNR broadcast payload is absent");
  const parsed: unknown = JSON.parse(encoded[1].replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, "&"));
  if (!Array.isArray(parsed) || parsed.length !== 8) throw new Error("LNR Pro D2 round must contain eight matches");
  const matches = parsed as LnrMatch[];
  const seasons = new Set<string>();
  const rounds = new Set<string>();
  const seen = new Set<string>();
  const result: ConfirmedMatchBroadcast[] = [];
  for (const match of matches) {
    const source = new URL(match.link);
    const edition = source.pathname.match(/^\/feuille-de-match\/(\d{4}-\d{4})\/(j\d+)\/(\d+)-/);
    if (source.origin !== "https://prod2.lnr.fr" || !edition) throw new Error("Invalid LNR fixture source or edition");
    seasons.add(edition[1]);
    rounds.add(edition[2]);
    if (!Number.isInteger(match.id) || seen.has(String(match.id))) throw new Error("Duplicate LNR fixture ID");
    if (Number(edition[3]) !== match.id) throw new Error("LNR source URL and fixture ID disagree");
    seen.add(String(match.id));
    const home = getProD2Team(match.hosting_club?.name);
    const away = getProD2Team(match.visiting_club?.name);
    if (!home || !away || home.slug === away.slug) throw new Error("Unknown or duplicate LNR team identity");
    // A postponed fixture or an absent channel remains unconfirmed.
    if (match.is_postponed || !match.broadcasters?.length) continue;
    const starts = match.timer?.firstPeriodStartDate;
    if (!starts || !/T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(starts) || !Number.isFinite(Date.parse(starts))) {
      throw new Error("LNR broadcast kickoff must include a source timezone");
    }
    const seasonStart = Number(edition[1].slice(0, 4));
    const kickoffYear = new Date(starts).getUTCFullYear();
    if (kickoffYear < seasonStart || kickoffYear > seasonStart + 1) throw new Error("LNR kickoff falls outside its edition");
    const providerIds = [...new Set(match.broadcasters.map(channel => {
      const id = LNR_CHANNELS[channel.name];
      if (!id) throw new Error(`Unmapped LNR broadcast channel: ${channel.name}`);
      return id;
    }))];
    result.push({ id: `lnr-${match.id}-fr`, competitionSlug: "fr-pro-d2", season: edition[1],
      home: home.name, away: away.name, startsAt: new Date(starts).toISOString(), country: "FR", providerIds,
      sourceName: "Ligue Nationale de Rugby", sourceUrl: source.href, checkedAt });
  }
  if (seasons.size !== 1) throw new Error("LNR payload mixes editions");
  if (rounds.size !== 1) throw new Error("LNR payload mixes rounds");
  if (!result.length) throw new Error("No confirmed LNR broadcasts in round");
  return result;
}
