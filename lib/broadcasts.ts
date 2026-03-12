export type BroadcastProviderId =
  | "disney-plus"
  | "espn"
  | "espn-plus"
  | "rugbypass-tv"
  | "urc-tv"
  | "youtube";

export type BroadcastProvider = {
  id: BroadcastProviderId;
  label: string;
  href?: string;
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
  "rugbypass-tv": {
    id: "rugbypass-tv",
    label: "RugbyPass TV",
    href: "https://rugbypass.tv",
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
  "ar-urba-top14": ["espn", "disney-plus"],
  "en-premiership-rugby": ["espn", "disney-plus"],
  "eu-champions-cup": ["espn", "disney-plus"],
  "fr-top14": ["espn", "disney-plus"],
  "int-six-nations": ["espn", "disney-plus"],
  "int-super-rugby-pacific": ["espn", "disney-plus"],
  "int-united-rugby-championship": ["espn", "disney-plus", "urc-tv"],
  "int-world-cup": ["espn", "disney-plus"],
  sra: ["espn", "disney-plus"],
  "svns-australia": ["espn", "disney-plus", "rugbypass-tv"],
  "svns-hong-kong": ["espn", "disney-plus", "rugbypass-tv"],
  "svns-singapore": ["espn", "disney-plus", "rugbypass-tv"],
  "svns-usa": ["espn", "disney-plus", "rugbypass-tv"],
  "us-mlr": ["disney-plus", "espn", "espn-plus"],
};

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
        href: "https://www.youtube.com/results?search_query=Tercer+Tiempo+Salta+Josema",
      };
    }

    return provider;
  });
}
