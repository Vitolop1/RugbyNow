import fs from "node:fs";
import path from "node:path";
import { getFallbackCompetitions } from "@/lib/fallbackData";

type SnapshotMatch = {
  id: number;
  season_id: number;
  match_date: string;
  kickoff_time: string | null;
  status: "NS" | "LIVE" | "FT" | "CANC";
  home_score: number | null;
  away_score: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
};

type SnapshotSeason = {
  id: number;
  name: string;
  competition_id: number;
};

type SnapshotCompetition = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
  group_name?: string | null;
  country_code?: string | null;
};

type SnapshotTeam = {
  id: number;
  name: string;
  slug: string | null;
};

type SnapshotPayload = {
  generatedAt: string;
  competitions: SnapshotCompetition[];
  seasons: SnapshotSeason[];
  teams: SnapshotTeam[];
  matches: SnapshotMatch[];
};

export type WeeklyArticle = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  leagueSlugs: string[];
  teaser: string;
  teaserEs?: string;
  titleEs?: string;
};

export type WeeklyMatchNote = {
  id: number;
  matchDate: string;
  status: "NS" | "LIVE" | "FT" | "CANC";
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type WeeklyLeagueDigest = {
  slug: string;
  name: string;
  group: string;
  region: string | null;
  articleCount: number;
  summary: string;
  summaryEs?: string;
  articles: WeeklyArticle[];
  recentMatches: WeeklyMatchNote[];
  upcomingMatches: WeeklyMatchNote[];
};

export type WeeklyDigestPayload = {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  leagues: WeeklyLeagueDigest[];
  sources: { key: string; name: string; homepage: string; feedUrl: string }[];
};

type SourceConfig = {
  key: string;
  name: string;
  homepage: string;
  feedUrl: string;
};

type LeagueConfig = {
  slug: string;
  aliases: string[];
};

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    key: "americas-rugby-news",
    name: "Americas Rugby News",
    homepage: "https://www.americasrugbynews.com",
    feedUrl: "https://www.americasrugbynews.com/feed/",
  },
  {
    key: "bbc-rugby-union",
    name: "BBC Rugby Union",
    homepage: "https://www.bbc.com/sport/rugby-union",
    feedUrl: "https://feeds.bbci.co.uk/sport/rugby-union/rss.xml",
  },
];

const CURATED_ARTICLES: WeeklyArticle[] = [
  {
    id: "onrugby:serie-a-elite-mercato-2025-26",
    title: "Rugbymercato Serie A Elite: tutti gli acquisti e le cessioni della stagione 2025/26",
    titleEs: "Mercado Serie A Elite: altas y bajas de la temporada 2025/26",
    link: "https://www.onrugby.it/2025/09/09/rugbymercato-serie-a-elite-tutti-gli-acquisti-e-le-cessioni-della-stagione-2025-26/",
    source: "OnRugby",
    publishedAt: "2025-09-09T00:00:00.000Z",
    leagueSlugs: ["it-serie-a-elite"],
    teaser:
      "OnRugby followed the full 2025/26 Serie A Elite market and the picture is clear: Argentine players are spread across the league.",
    teaserEs:
      "OnRugby siguio todo el mercado 2025/26 de la Serie A Elite y el panorama es claro: hay jugadores argentinos repartidos por toda la liga.",
  },
  {
    id: "onrugby:viadana-ledesma",
    title: "Viadana, l'apertura argentina Tadeo Ledesma e giallonera",
    titleEs: "Viadana suma al apertura argentino Tadeo Ledesma",
    link: "https://www.onrugby.it/2025/07/16/viadana-lapertura-argentina-tadeo-ledesma-e-giallonera/",
    source: "OnRugby",
    publishedAt: "2025-07-16T00:00:00.000Z",
    leagueSlugs: ["it-serie-a-elite"],
    teaser:
      "Viadana added Argentine fly-half Tadeo Ledesma as part of its build for the new Serie A Elite season.",
    teaserEs:
      "Viadana incorporo al apertura argentino Tadeo Ledesma como parte de su armado para la nueva temporada de Serie A Elite.",
  },
  {
    id: "onrugby:mogliano-bruno",
    title: "Serie A Elite, Mogliano: nuovo rinforzo in seconda linea",
    titleEs: "Mogliano suma al argentino Felipe Bruno en la segunda linea",
    link: "https://www.onrugby.it/2025/08/07/serie-a-elite-mogliano-nuovo-rinforzo-in-seconda-linea/",
    source: "OnRugby",
    publishedAt: "2025-08-07T00:00:00.000Z",
    leagueSlugs: ["it-serie-a-elite"],
    teaser:
      "Mogliano reinforced its pack with Argentine lock Felipe Bruno, another sign of Argentina's growing footprint in Italy's top flight.",
    teaserEs:
      "Mogliano reforzo su pack con el segunda linea argentino Felipe Bruno, otra senal del peso que tiene Argentina en la elite italiana.",
  },
  {
    id: "onrugby:valorugby-due-argentini",
    title: "Serie A Elite: due argentini per il Valorugby Emilia",
    titleEs: "Valorugby Emilia incorpora dos argentinos para la Serie A Elite",
    link: "https://www.onrugby.it/2025/08/09/serie-a-elite-due-argentini-per-il-valorugby-emilia/",
    source: "OnRugby",
    publishedAt: "2025-08-09T00:00:00.000Z",
    leagueSlugs: ["it-serie-a-elite"],
    teaser:
      "Valorugby Emilia added two Argentine players, reinforcing the Argentine pipeline into the Italian domestic game.",
    teaserEs:
      "Valorugby Emilia sumo dos jugadores argentinos, reforzando la via argentina dentro del rugby italiano.",
  },
];

const LEAGUE_CONFIGS: LeagueConfig[] = [
  { slug: "fr-top14", aliases: ["top 14", "stade toulousain", "montpellier", "clermont", "racing 92", "toulon"] },
  { slug: "it-serie-a-elite", aliases: ["serie a elite", "rovigo", "viadana", "petrarca", "mogliano", "valorugby", "colorno", "fiamme oro"] },
  { slug: "int-six-nations", aliases: ["six nations", "england", "wales", "ireland", "scotland", "france", "italy"] },
  { slug: "sra", aliases: ["super rugby americas", "sra", "pampas", "dogos", "selknam", "peñarol", "penarol", "tarucas", "yacare", "capibaras", "cobras"] },
  { slug: "en-premiership-rugby", aliases: ["premiership rugby", "leicester tigers", "saracens", "harlequins", "sale sharks", "northampton saints"] },
  { slug: "eu-champions-cup", aliases: ["champions cup", "european rugby champions cup"] },
  { slug: "int-world-cup", aliases: ["rugby world cup", "world cup rugby"] },
  { slug: "int-nations-championship", aliases: ["nations championship"] },
  { slug: "int-super-rugby-pacific", aliases: ["super rugby pacific", "super rugby", "crusaders", "blues", "chiefs", "brumbies", "hurricanes"] },
  { slug: "ar-urba-top14", aliases: ["urba", "urba top 14", "top 14 argentina", "casi", "sic", "belgrano athletic", "newman"] },
  { slug: "us-mlr", aliases: ["major league rugby", "mlr", "free jacks", "seawolves", "old glory", "chicago hounds"] },
  { slug: "ar-liga-norte-grande", aliases: ["norte grande", "liga norte grande"] },
  { slug: "int-united-rugby-championship", aliases: ["united rugby championship", "urc", "leinster", "munster", "stormers", "bulls"] },
  { slug: "svns-australia", aliases: ["svns australia", "perth sevens", "australia sevens"] },
  { slug: "svns-usa", aliases: ["svns usa", "vancouver 7", "usa 7s", "usa women the best of the americas at 2026 vancouver 7's"] },
  { slug: "svns-hong-kong", aliases: ["svns hong kong", "hong kong sevens"] },
  { slug: "svns-singapore", aliases: ["svns singapore", "singapore sevens"] },
];

function digestPath() {
  return path.join(process.cwd(), "data", "weekly-digest.json");
}

function snapshotPath() {
  return path.join(process.cwd(), "data", "supabase-snapshot.json");
}

function stripHtml(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function parseRssItems(xml: string) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return items.map((item) => ({
    title: xmlTagValue(item, "title"),
    link: xmlTagValue(item, "link"),
    description: xmlTagValue(item, "description"),
    pubDate: xmlTagValue(item, "pubDate"),
  }));
}

function normalizeText(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teaserFromDescription(description: string) {
  const clean = stripHtml(description);
  return clean.length > 180 ? `${clean.slice(0, 177).trim()}...` : clean;
}

function classifyLeagueSlugs(title: string, description: string) {
  const haystack = normalizeText(`${title} ${description}`);
  return LEAGUE_CONFIGS.filter((league) => league.aliases.some((alias) => haystack.includes(normalizeText(alias)))).map(
    (league) => league.slug
  );
}

function dedupeArticles(articles: WeeklyArticle[]) {
  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = normalizeText(`${article.source}|${article.title}|${article.link}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tryParseDate(value: string) {
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

async function fetchArticles() {
  const results: WeeklyArticle[] = [];

  for (const source of SOURCE_CONFIGS) {
    try {
      const response = await fetch(source.feedUrl, {
        headers: { "user-agent": "RugbyNow Weekly Bot/1.0" },
        cache: "no-store",
      });
      if (!response.ok) continue;
      const xml = await response.text();
      const items = parseRssItems(xml);

      for (const item of items) {
        if (!item.title || !item.link) continue;
        const leagueSlugs = classifyLeagueSlugs(item.title, item.description);
        if (!leagueSlugs.length) continue;
        const teaser = teaserFromDescription(item.description || item.title);
        results.push({
          id: `${source.key}:${item.link}`,
          title: item.title,
          link: item.link,
          source: source.name,
          publishedAt: tryParseDate(item.pubDate),
          leagueSlugs,
          teaser,
          teaserEs: teaser,
          titleEs: item.title,
        });
      }
    } catch {
      continue;
    }
  }

  return dedupeArticles([...CURATED_ARTICLES, ...results]).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}

function loadSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(snapshotPath(), "utf8")) as SnapshotPayload;
  } catch {
    return null;
  }
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function summarizeLeague(
  competition: SnapshotCompetition,
  articles: WeeklyArticle[],
  recentMatches: WeeklyMatchNote[],
  upcomingMatches: WeeklyMatchNote[]
) {
  const pieces: string[] = [];
  if (articles.length) pieces.push(`${articles.length} linked stories tracked for ${competition.name}.`);
  if (recentMatches.length) {
    const latest = recentMatches[0];
    pieces.push(`Latest result: ${latest.home} ${latest.homeScore ?? ""}-${latest.awayScore ?? ""} ${latest.away}.`.replace(/\s+/g, " ").trim());
  }
  if (upcomingMatches.length) {
    const next = upcomingMatches[0];
    pieces.push(`Next fixture: ${next.home} vs ${next.away} on ${next.matchDate}.`);
  }
  if (!pieces.length) pieces.push(`Weekly desk for ${competition.name}: article feed is ready, but there are no curated notes yet.`);
  return pieces.join(" ");
}

function summarizeLeagueEs(
  competition: SnapshotCompetition,
  articles: WeeklyArticle[],
  recentMatches: WeeklyMatchNote[],
  upcomingMatches: WeeklyMatchNote[]
) {
  const pieces: string[] = [];
  if (articles.length) pieces.push(`${articles.length} noticias enlazadas para ${competition.name}.`);
  if (recentMatches.length) {
    const latest = recentMatches[0];
    pieces.push(`Ultimo resultado: ${latest.home} ${latest.homeScore ?? ""}-${latest.awayScore ?? ""} ${latest.away}.`.replace(/\s+/g, " ").trim());
  }
  if (upcomingMatches.length) {
    const next = upcomingMatches[0];
    pieces.push(`Proximo partido: ${next.home} vs ${next.away} el ${next.matchDate}.`);
  }
  if (!pieces.length) pieces.push(`Mesa semanal de ${competition.name}: la fuente de noticias esta lista, pero todavia no hay notas curadas.`);
  return pieces.join(" ");
}

async function maybeAiEnrich(payload: WeeklyDigestPayload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return payload;

  try {
    const compact = payload.leagues.map((league) => ({
      slug: league.slug,
      name: league.name,
      summary: league.summary,
      articles: league.articles.slice(0, 4).map((article) => ({
        title: article.title,
        teaser: article.teaser,
        source: article.source,
      })),
      recentMatches: league.recentMatches.slice(0, 3),
      upcomingMatches: league.upcomingMatches.slice(0, 3),
    }));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_WEEKLY_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are writing short rugby weekly digests. Return valid JSON only. For each league, produce a concise editorial summary in English and Spanish, grounded only in the supplied items.",
          },
          {
            role: "user",
            content: JSON.stringify(compact),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "weekly_digest_enrichment",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                leagues: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      slug: { type: "string" },
                      summary: { type: "string" },
                      summaryEs: { type: "string" },
                    },
                    required: ["slug", "summary", "summaryEs"],
                  },
                },
              },
              required: ["leagues"],
            },
          },
        },
      }),
    });

    if (!response.ok) return payload;
    const json = await response.json();
    const outputText = json.output_text;
    if (!outputText) return payload;
    const enrichment = JSON.parse(outputText) as { leagues?: Array<{ slug: string; summary: string; summaryEs: string }> };
    const bySlug = new Map((enrichment.leagues || []).map((league) => [league.slug, league]));

    return {
      ...payload,
      leagues: payload.leagues.map((league) => {
        const next = bySlug.get(league.slug);
        if (!next) return league;
        return {
          ...league,
          summary: next.summary || league.summary,
          summaryEs: next.summaryEs || league.summaryEs,
        };
      }),
    };
  } catch {
    return payload;
  }
}

export async function buildWeeklyDigest() {
  const snapshot = loadSnapshot();
  const articles = await fetchArticles();
  const now = new Date();
  const windowStart = toISODate(addDays(now, -7));
  const windowEnd = toISODate(addDays(now, 7));

  const basePayload: WeeklyDigestPayload = {
    generatedAt: new Date().toISOString(),
    windowStart,
    windowEnd,
    leagues: [],
    sources: SOURCE_CONFIGS.map((source) => ({
      key: source.key,
      name: source.name,
      homepage: source.homepage,
      feedUrl: source.feedUrl,
    })),
  };

  if (!snapshot) return basePayload;

  const teamsById = new Map(snapshot.teams.map((team) => [team.id, team]));

  const desiredSlugs = new Set([
    "fr-top14",
    "it-serie-a-elite",
    "int-six-nations",
    "sra",
    "en-premiership-rugby",
    "eu-champions-cup",
    "int-world-cup",
    "int-nations-championship",
    "int-super-rugby-pacific",
    "ar-urba-top14",
    "us-mlr",
    "ar-liga-norte-grande",
    "int-united-rugby-championship",
    "svns-australia",
    "svns-usa",
    "svns-hong-kong",
    "svns-singapore",
  ]);

  const leagueMap = new Map<string, SnapshotCompetition>();
  for (const competition of snapshot.competitions.filter((competition) => desiredSlugs.has(competition.slug))) {
    leagueMap.set(competition.slug, competition);
  }
  for (const competition of getFallbackCompetitions().filter((competition) => desiredSlugs.has(competition.slug))) {
    if (!leagueMap.has(competition.slug)) {
      leagueMap.set(competition.slug, competition as SnapshotCompetition);
    }
  }

  const leagues = Array.from(leagueMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  for (const competition of leagues) {
    const competitionSeasons = snapshot.seasons.filter((season) => season.competition_id === competition.id).map((season) => season.id);
    const leagueMatches = snapshot.matches.filter((match) => competitionSeasons.includes(match.season_id));
    const recentMatches = leagueMatches
      .filter((match) => match.match_date >= windowStart && match.match_date <= toISODate(now) && match.status === "FT")
      .sort((a, b) => b.match_date.localeCompare(a.match_date))
      .slice(0, 5)
      .map((match) => ({
        id: match.id,
        matchDate: match.match_date,
        status: match.status,
        home: teamsById.get(match.home_team_id || 0)?.name || "Home",
        away: teamsById.get(match.away_team_id || 0)?.name || "Away",
        homeScore: match.home_score,
        awayScore: match.away_score,
      }));
    const upcomingMatches = leagueMatches
      .filter((match) => match.match_date > toISODate(now) && match.match_date <= windowEnd)
      .sort((a, b) => a.match_date.localeCompare(b.match_date))
      .slice(0, 5)
      .map((match) => ({
        id: match.id,
        matchDate: match.match_date,
        status: match.status,
        home: teamsById.get(match.home_team_id || 0)?.name || "Home",
        away: teamsById.get(match.away_team_id || 0)?.name || "Away",
        homeScore: match.home_score,
        awayScore: match.away_score,
      }));

    const leagueArticles = articles.filter((article) => article.leagueSlugs.includes(competition.slug)).slice(0, 8);
    basePayload.leagues.push({
      slug: competition.slug,
      name: competition.name,
      group: competition.group_name || "Other",
      region: competition.region,
      articleCount: leagueArticles.length,
      summary: summarizeLeague(competition, leagueArticles, recentMatches, upcomingMatches),
      summaryEs: summarizeLeagueEs(competition, leagueArticles, recentMatches, upcomingMatches),
      articles: leagueArticles,
      recentMatches,
      upcomingMatches,
    });
  }

  return maybeAiEnrich(basePayload);
}

export function readWeeklyDigest() {
  try {
    return JSON.parse(fs.readFileSync(digestPath(), "utf8")) as WeeklyDigestPayload;
  } catch {
    return null;
  }
}

export function writeWeeklyDigest(payload: WeeklyDigestPayload) {
  fs.mkdirSync(path.dirname(digestPath()), { recursive: true });
  fs.writeFileSync(digestPath(), JSON.stringify(payload, null, 2), "utf8");
}
