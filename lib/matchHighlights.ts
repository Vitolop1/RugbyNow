type MatchStatus = "NS" | "LIVE" | "FT";

type TeamRef =
  | { id?: number | null; name?: string | null; slug?: string | null }
  | { id?: number | null; name?: string | null; slug?: string | null }[]
  | null
  | undefined;

type CompetitionRef =
  | {
      slug?: string | null;
    }
  | null
  | undefined;

type SeasonRef =
  | {
      competition?: CompetitionRef | CompetitionRef[] | null;
    }
  | null
  | undefined;

type MatchWithTeams = {
  status: MatchStatus | string;
  match_date: string;
  kickoff_time?: string | null;
  home_team?: TeamRef;
  away_team?: TeamRef;
  season?: SeasonRef | SeasonRef[] | null;
};

export type MatchHighlightFields = {
  highlight_url?: string | null;
  highlight_title?: string | null;
  highlight_published?: string | null;
};

type HighlightVideo = {
  videoId: string;
  title: string;
  publishedText: string | null;
};

type HighlightChannelConfig = {
  competitionSlug: string;
  handlePath: string;
};

const CHANNELS: HighlightChannelConfig[] = [
  {
    competitionSlug: "sra",
    handlePath: "@SuperRugbyAmericas",
  },
];

const CACHE_TTL_MS = 10 * 60 * 1000;

const channelCache = new Map<string, { expiresAt: number; videos: HighlightVideo[] }>();

function unwrapFirst<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function competitionSlugForMatch(match: MatchWithTeams) {
  const season = unwrapFirst(match.season);
  const competition = season ? unwrapFirst(season.competition) : null;
  return competition?.slug ?? null;
}

function teamName(team: TeamRef) {
  return unwrapFirst(team)?.name ?? null;
}

function teamTokens(name?: string | null) {
  const normalized = normalizeText(name);
  const out = new Set<string>();
  if (!normalized) return out;

  out.add(normalized);

  const stripped = normalized
    .replace(/\bxv\b/g, " ")
    .replace(/\brugby\b/g, " ")
    .replace(/\brc\b/g, " ")
    .replace(/\bclub\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped && stripped !== normalized && stripped.length >= 3) out.add(stripped);

  const aliases: Record<string, string[]> = {
    "pampas xv": ["pampas"],
    penarol: ["penarol rugby"],
    "penarol rugby": ["penarol"],
    cobras: ["cobras brasil rugby"],
    "cobras brasil rugby": ["cobras"],
    "capibaras xv": ["capibaras"],
    "yacare xv": ["yacare"],
    "dogos xv": ["dogos"],
  };

  for (const alias of aliases[normalized] ?? []) {
    out.add(alias);
  }

  return out;
}

function titleLooksLikeHighlight(title: string) {
  const normalized = normalizeText(title);
  return normalized.includes("highlight") || normalized.includes("highlights") || normalized.includes("resumen");
}

function extractInitialData(html: string) {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const end = html.indexOf(";</script>", start);
  if (end === -1) return null;

  try {
    return JSON.parse(html.slice(start + marker.length, end));
  } catch {
    return null;
  }
}

function collectVideoRenderers(node: unknown, out: Array<Record<string, unknown>>) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out);
    return;
  }

  if ("videoRenderer" in node && node.videoRenderer && typeof node.videoRenderer === "object") {
    out.push(node.videoRenderer as Record<string, unknown>);
  }

  for (const value of Object.values(node)) {
    collectVideoRenderers(value, out);
  }
}

function textFromRuns(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const maybeRuns = value as { runs?: Array<{ text?: string }>; simpleText?: string };
  if (typeof maybeRuns.simpleText === "string") return maybeRuns.simpleText;
  if (Array.isArray(maybeRuns.runs)) {
    return maybeRuns.runs.map((item) => item.text ?? "").join("").trim();
  }
  return "";
}

async function fetchChannelVideos(handlePath: string) {
  const now = Date.now();
  const cached = channelCache.get(handlePath);
  if (cached && cached.expiresAt > now) return cached.videos;

  const response = await fetch(`https://www.youtube.com/${handlePath}/videos`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`YouTube channel fetch failed (${response.status})`);
  }

  const html = await response.text();
  const initialData = extractInitialData(html);
  if (!initialData) {
    throw new Error("Unable to parse YouTube channel data");
  }

  const renderers: Array<Record<string, unknown>> = [];
  collectVideoRenderers(initialData, renderers);

  const videos = renderers
    .map((renderer) => ({
      videoId: typeof renderer.videoId === "string" ? renderer.videoId : "",
      title: textFromRuns(renderer.title),
      publishedText: textFromRuns(renderer.publishedTimeText) || null,
    }))
    .filter((video) => video.videoId && video.title)
    .slice(0, 30);

  channelCache.set(handlePath, {
    expiresAt: now + CACHE_TTL_MS,
    videos,
  });

  return videos;
}

function pickHighlightForMatch(match: MatchWithTeams, videos: HighlightVideo[]) {
  const home = teamName(match.home_team);
  const away = teamName(match.away_team);
  if (!home || !away) return null;

  const homeTokens = Array.from(teamTokens(home));
  const awayTokens = Array.from(teamTokens(away));
  if (!homeTokens.length || !awayTokens.length) return null;

  return (
    videos.find((video) => {
      if (!titleLooksLikeHighlight(video.title)) return false;
      const title = normalizeText(video.title);
      const hasHome = homeTokens.some((token) => token && title.includes(token));
      const hasAway = awayTokens.some((token) => token && title.includes(token));
      return hasHome && hasAway;
    }) ?? null
  );
}

export async function attachHighlightsToMatches<T extends MatchWithTeams>(
  matches: T[],
  explicitCompetitionSlug?: string | null
): Promise<Array<T & MatchHighlightFields>> {
  const configs = new Map(CHANNELS.map((item) => [item.competitionSlug, item]));

  const slugsToFetch = new Set<string>();
  for (const match of matches) {
    if (match.status !== "FT") continue;
    const slug = explicitCompetitionSlug ?? competitionSlugForMatch(match);
    if (slug && configs.has(slug)) slugsToFetch.add(slug);
  }

  if (!slugsToFetch.size) {
    return matches.map((match) => ({ ...match, highlight_url: null, highlight_title: null, highlight_published: null }));
  }

  const videosBySlug = new Map<string, HighlightVideo[]>();

  await Promise.all(
    Array.from(slugsToFetch).map(async (slug) => {
      const config = configs.get(slug);
      if (!config) return;
      try {
        videosBySlug.set(slug, await fetchChannelVideos(config.handlePath));
      } catch {
        videosBySlug.set(slug, []);
      }
    })
  );

  return matches.map((match) => {
    if (match.status !== "FT") {
      return { ...match, highlight_url: null, highlight_title: null, highlight_published: null };
    }

    const slug = explicitCompetitionSlug ?? competitionSlugForMatch(match);
    const videos = slug ? videosBySlug.get(slug) ?? [] : [];
    const selected = pickHighlightForMatch(match, videos);

    return {
      ...match,
      highlight_url: selected ? `https://www.youtube.com/watch?v=${selected.videoId}` : null,
      highlight_title: selected?.title ?? null,
      highlight_published: selected?.publishedText ?? null,
    };
  });
}
