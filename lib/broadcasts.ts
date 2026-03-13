export type BroadcastProviderId =
  | "disney-plus"
  | "espn"
  | "espn-plus"
  | "rai-sport"
  | "rugbypass-tv"
  | "the-rugby-channel"
  | "urc-tv"
  | "youtube";

export type BroadcastProvider = {
  id: BroadcastProviderId;
  label: string;
  href?: string;
};

export type SuggestedWatchLink = {
  label: string;
  href: string;
};

const PROVIDERS: Record<BroadcastProviderId, BroadcastProvider> = {
  "disney-plus": {
    id: "disney-plus",
    label: "Disney+",
    href: "https://www.disneyplus.com",
  },
  espn: {
    id: "espn",
    label: "ESPN",
    href: "https://www.espn.com/rugby/",
  },
  "espn-plus": {
    id: "espn-plus",
    label: "ESPN+",
    href: "https://plus.espn.com",
  },
  "rai-sport": {
    id: "rai-sport",
    label: "Rai Sport",
    href: "https://www.raisport.rai.it/",
  },
  "rugbypass-tv": {
    id: "rugbypass-tv",
    label: "RugbyPass TV",
    href: "https://rugbypass.tv",
  },
  "the-rugby-channel": {
    id: "the-rugby-channel",
    label: "The Rugby Channel",
    href: "https://www.therugbychannel.it/",
  },
  "urc-tv": {
    id: "urc-tv",
    label: "URC TV",
    href: "https://www.unitedrugby.com/urctv",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com",
  },
};

const BROADCASTS_BY_COMPETITION: Partial<Record<string, BroadcastProviderId[]>> = {
  "ar-liga-norte-grande": ["youtube"],
  "ar-urba-top14": ["disney-plus", "espn"],
  "en-premiership-rugby": ["disney-plus", "espn"],
  "eu-champions-cup": ["disney-plus", "espn"],
  "fr-top14": ["disney-plus", "espn"],
  "it-serie-a-elite": ["the-rugby-channel", "rai-sport"],
  "int-six-nations": ["disney-plus", "espn"],
  "int-super-rugby-pacific": ["disney-plus", "espn"],
  "int-united-rugby-championship": ["disney-plus", "espn", "urc-tv"],
  "int-world-cup": ["disney-plus", "espn"],
  sra: ["disney-plus", "espn"],
  "svns-australia": ["disney-plus", "espn", "rugbypass-tv"],
  "svns-hong-kong": ["disney-plus", "espn", "rugbypass-tv"],
  "svns-singapore": ["disney-plus", "espn", "rugbypass-tv"],
  "svns-usa": ["disney-plus", "espn", "rugbypass-tv"],
  "us-mlr": ["disney-plus", "espn-plus"],
};

const SUGGESTED_PROVIDER_PRIORITY: BroadcastProviderId[] = [
  "espn",
  "espn-plus",
  "disney-plus",
  "rugbypass-tv",
  "youtube",
  "rai-sport",
  "the-rugby-channel",
  "urc-tv",
];

export function getBroadcastLogo(id: BroadcastProviderId) {
  return `/broadcast-logos/${id}.png`;
}

export function getBroadcastsForCompetition(slug?: string | null): BroadcastProvider[] {
  if (!slug) return [];

  const ids = BROADCASTS_BY_COMPETITION[slug] || [];
  return ids.map((id) => {
    const provider = PROVIDERS[id];

    if (slug === "ar-liga-norte-grande" && id === "youtube") {
      return {
        ...provider,
        href: "https://www.youtube.com/@tercertiemposalta",
      };
    }

    return provider;
  });
}

function buildWatchSearchLink(home?: string | null, away?: string | null): SuggestedWatchLink | null {
  const teams = [home, away].map((value) => value?.trim()).filter(Boolean);
  if (!teams.length) return null;

  const query = encodeURIComponent(`${teams.join(" vs ")} rugby where to watch`);
  return {
    label: "Google",
    href: `https://www.google.com/search?q=${query}`,
  };
}

export function getWatchOptions(params: {
  competitionSlug?: string | null;
  home?: string | null;
  away?: string | null;
}): SuggestedWatchLink[] {
  const providers = getBroadcastsForCompetition(params.competitionSlug);
  const options: SuggestedWatchLink[] = [];
  const seen = new Set<string>();

  const pushOption = (option: SuggestedWatchLink | null) => {
    if (!option) return;
    const key = `${option.label}|${option.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  };

  for (const providerId of SUGGESTED_PROVIDER_PRIORITY) {
    const provider = providers.find((item) => item.id === providerId && item.href);
    if (provider?.href) {
      pushOption({
        label: provider.label,
        href: provider.href,
      });
    }
  }

  pushOption(buildWatchSearchLink(params.home, params.away));

  return options;
}

export function getSuggestedWatchLink(params: {
  competitionSlug?: string | null;
  home?: string | null;
  away?: string | null;
}): SuggestedWatchLink | null {
  return getWatchOptions(params)[0] ?? null;
}
