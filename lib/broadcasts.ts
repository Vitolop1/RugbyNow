export type BroadcastProviderId =
  | "disney-plus"
  | "espn"
  | "espn-plus"
  | "noa-sports-go"
  | "quiero-deporte"
  | "rai-sport"
  | "rugbypass-tv"
  | "tercer-tiempo-salta"
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
  "noa-sports-go": {
    id: "noa-sports-go",
    label: "Noa Sports Go",
    href: "https://www.youtube.com/@NoaSportsGo",
  },
  "quiero-deporte": {
    id: "quiero-deporte",
    label: "Quiero Deporte",
    href: "https://www.youtube.com/@QuieroDeporte",
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
  "tercer-tiempo-salta": {
    id: "tercer-tiempo-salta",
    label: "Tercer Tiempo Salta",
    href: "https://www.youtube.com/@tercertiemposalta",
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

const SUGGESTED_PROVIDER_PRIORITY: BroadcastProviderId[] = [
  "espn",
  "espn-plus",
  "disney-plus",
  "rugbypass-tv",
  "tercer-tiempo-salta",
  "noa-sports-go",
  "quiero-deporte",
  "youtube",
  "rai-sport",
  "the-rugby-channel",
  "urc-tv",
];

export function getBroadcastLogo(id: BroadcastProviderId) {
  if (id === "tercer-tiempo-salta" || id === "noa-sports-go" || id === "quiero-deporte") {
    return "/broadcast-logos/youtube.png";
  }
  return `/broadcast-logos/${id}.png`;
}

// A competition does not establish event-specific rights in the visitor's country.
// Confirmed dated listings are supplied by the agenda, not inferred here.
export function getBroadcastsForCompetition(_slug?: string | null): BroadcastProvider[] {
  return [];
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
