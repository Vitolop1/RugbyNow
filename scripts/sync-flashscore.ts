import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";
import { chromium, Page } from "playwright";

type MatchStatus = "NS" | "LIVE" | "FT";

type FlashInput = {
  compSlug: string | null;
  url: string;
};

type TeamRow = {
  id: number;
  name: string;
};

type CompetitionRow = {
  id: number;
  slug: string;
  name?: string;
};

type SeasonRow = {
  id: number;
  name: string;
};

type DbMatchRow = {
  id: number;
  season_id: number;
  match_date: string;
  kickoff_time: string | null;
  status: MatchStatus;
  minute: number | null;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  source_event_key: string | null;
};

type ScrapedRow = {
  home: string;
  away: string;
  hs: string;
  as: string;
  statusOrTime: string;
  roundText: string;
  rawText: string;
  dateLabel: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FLASH_URLS = process.env.FLASH_URLS;
const LIVE_ONLY = process.env.LIVE_ONLY === "1";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FLASH_URLS) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLASH_URLS");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string) {
  return norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseScore(x: string) {
  const t = (x || "").trim().replace("–", "-");
  if (t === "-" || t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

function parseRound(raw: string): number | null {
  const s = (raw || "").trim();
  if (!s) return null;

  const m1 = s.match(/\bround\s+(\d+)\b/i);
  if (m1) return Number.parseInt(m1[1], 10);

  const m2 = s.match(/\b(\d+)\b/);
  if (m2) return Number.parseInt(m2[1], 10);

  return null;
}

function detectStatusAndMinute(raw: string) {
  const s = (raw || "").toUpperCase().trim();

  if (/(POSTP|CANC|CANCEL|ABAND|ABD)/.test(s)) {
    return { status: "NS" as MatchStatus, minute: null as number | null };
  }

  if (/(FT|FINAL|AET)/.test(s)) {
    return { status: "FT" as MatchStatus, minute: null as number | null };
  }

  if (/(HT|LIVE)/.test(s)) {
    return { status: "LIVE" as MatchStatus, minute: null as number | null };
  }

  const m = s.match(/\b(\d{1,3})\s*'\b/);
  if (m) {
    return { status: "LIVE" as MatchStatus, minute: Number.parseInt(m[1], 10) };
  }

  return { status: "NS" as MatchStatus, minute: null as number | null };
}

function urlsFromEnv(): FlashInput[] {
  const tokens = FLASH_URLS!.split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: FlashInput[] = [];
  for (const tok of tokens) {
    const eq = tok.indexOf("=");
    if (eq > 0) {
      const slug = tok.slice(0, eq).trim();
      const url = tok.slice(eq + 1).trim();
      out.push({ compSlug: slug || null, url });
    } else {
      out.push({ compSlug: null, url: tok });
    }
  }
  return out;
}

function normalizeFlashUrl(raw: string) {
  const u = new URL(raw.trim());
  u.search = "";
  u.hash = "";
  u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

function buildFlashVariants(raw: string) {
  const original = normalizeFlashUrl(raw);
  const base = original.replace(/\/fixtures$/i, "").replace(/\/results$/i, "");

  if (LIVE_ONLY) {
    return [`${base}/fixtures`];
  }

  return [`${base}/results`, `${base}/fixtures`];
}

function competitionSlugFromUrl(url: string) {
  const normalized = normalizeFlashUrl(url);
  const u = new URL(normalized);
  const parts = u.pathname.split("/").filter(Boolean);

  if (parts.length < 3) return null;
  if (parts[0] !== "rugby-union") return null;

  const regionOrCountry = parts[1];
  const compSlug = parts[2];

  if (compSlug === "top-14") return "fr-top14";
  if (compSlug === "serie-a-elite") return "it-serie-a-elite";
  if (compSlug === "six-nations") return "int-six-nations";
  if (compSlug === "super-rugby-americas") return "sra";

  if (regionOrCountry === "england" && (compSlug.includes("premier") || compSlug.includes("premiership"))) {
    return "en-premiership";
  }
  if (regionOrCountry === "argentina" && (compSlug.includes("urba") || compSlug.includes("top"))) {
    return "ar-urba-top14";
  }

  return null;
}

function seasonSortKey(name: string) {
  const s = (name || "").trim();

  const mRange = s.match(/\b(\d{4})\s*\/\s*(\d{2,4})\b/);
  if (mRange) {
    const a = Number.parseInt(mRange[1], 10);
    const bRaw = mRange[2];
    const b =
      bRaw.length === 2
        ? Number.parseInt(`${mRange[1].slice(0, 2)}${bRaw}`, 10)
        : Number.parseInt(bRaw, 10);
    return Math.max(a, b);
  }

  const mYear = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (mYear) return Number.parseInt(mYear[1], 10);

  return 0;
}

function seasonYearBounds(seasonName: string) {
  const s = (seasonName || "").trim();
  const mRange = s.match(/\b(\d{4})\s*\/\s*(\d{2,4})\b/);

  if (mRange) {
    const y1 = Number.parseInt(mRange[1], 10);
    const y2raw = mRange[2];
    const y2 =
      y2raw.length === 2
        ? Number.parseInt(`${mRange[1].slice(0, 2)}${y2raw}`, 10)
        : Number.parseInt(y2raw, 10);
    return { startYear: y1, endYear: y2 };
  }

  const mYear = s.match(/\b(19\d{2}|20\d{2})\b/);
  if (mYear) {
    const y = Number.parseInt(mYear[1], 10);
    return { startYear: y, endYear: y };
  }

  const now = new Date().getUTCFullYear();
  return { startYear: now, endYear: now };
}

async function getLatestSeasonIdByCompSlug(compSlug: string) {
  const { data: comp, error: compErr } = await supabase
    .from("competitions")
    .select("id,slug,name")
    .eq("slug", compSlug)
    .maybeSingle<CompetitionRow>();

  if (compErr) throw compErr;
  if (!comp?.id) throw new Error(`No competition found for slug=${compSlug}`);

  const { data: seasons, error: seasonErr } = await supabase
    .from("seasons")
    .select("id,name")
    .eq("competition_id", comp.id);

  if (seasonErr) throw seasonErr;
  if (!seasons || seasons.length === 0) throw new Error(`No seasons found for compSlug=${compSlug}`);

  const best = seasons
    .slice()
    .sort((a, b) => seasonSortKey((b as any).name) - seasonSortKey((a as any).name))[0] as SeasonRow;

  return { seasonId: best.id, seasonName: best.name };
}

async function getTeamsMap() {
  const { data, error } = await supabase.from("teams").select("id,name");
  if (error) throw error;

  const map = new Map<string, number>();
  const names: string[] = [];

  for (const t of (data || []) as TeamRow[]) {
    const n = norm(t.name);
    map.set(n, t.id);
    names.push(n);
  }

  map.set(norm("Emilia"), 33);
  map.set(norm("Valorugby"), 33);
  map.set(norm("Valorugby Emilia"), 33);
  map.set(norm("Petrarca Padova"), 31);
  map.set(norm("Rugby Lyons"), 38);
  map.set(norm("Lyons"), 38);

  map.set(norm("Aviron Bayonnais"), 51);
  map.set(norm("Bayonne"), 51);
  map.set(norm("RC Toulonnais"), 46);
  map.set(norm("Toulon"), 46);
  map.set(norm("Stade Francais Paris"), 45);
  map.set(norm("Stade Français Paris"), 45);
  map.set(norm("Stade Francais"), 45);
  map.set(norm("Stade Rochelais"), 50);
  map.set(norm("Stade Toulousain"), 41);

  map.set(norm("Cobras"), 9);
  map.set(norm("Cobras Brasil"), 9);
  map.set(norm("Capibaras"), 14);
  map.set(norm("Capibaras XV"), 14);
  map.set(norm("Pampas XV"), 12);
  map.set(norm("Pampas"), 12);

  return { teamsMap: map, teamNamesNorm: names };
}

function resolveTeamId(rawName: string, teamsMap: Map<string, number>, teamNamesNorm: string[]) {
  const n = norm(rawName);
  if (!n) return null;

  const direct = teamsMap.get(n);
  if (direct) return direct;

  const tokens = n.split(" ").filter(Boolean);

  let bestName: string | null = null;
  let bestScore = 0;

  for (const candidate of teamNamesNorm) {
    let score = 0;

    if (candidate.includes(n) || n.includes(candidate)) score += 2;

    for (const tok of tokens) {
      if (tok.length < 3) continue;
      if (candidate.includes(tok)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestName = candidate;
    }
  }

  if (!bestName || bestScore < 2) return null;
  return teamsMap.get(bestName) ?? null;
}

async function getOrCreateTeamId(rawName: string, teamsMap: Map<string, number>, teamNamesNorm: string[]) {
  const existing = resolveTeamId(rawName, teamsMap, teamNamesNorm);
  if (existing) return existing;

  const cleanName = rawName.trim();
  if (!cleanName) return null;

  const slug = slugify(cleanName);
  if (!slug) return null;

  const { data, error } = await supabase
    .from("teams")
    .upsert(
      {
        name: cleanName,
        slug,
        type: "club",
      },
      { onConflict: "slug" }
    )
    .select("id,name")
    .single();

  if (error) {
    console.log("WARN: failed to upsert team:", cleanName, error.message);
    return null;
  }

  const row = data as TeamRow;
  const n = norm(row.name);
  if (!teamsMap.has(n)) {
    teamsMap.set(n, row.id);
    teamNamesNorm.push(n);
  }

  return row.id;
}

async function getRecentMatchesBySeason(seasonId: number) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const to = new Date(today);
  to.setDate(to.getDate() + 30);

  const isoFrom = from.toISOString().slice(0, 10);
  const isoTo = to.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("matches")
    .select(
      "id,season_id,match_date,kickoff_time,status,minute,home_team_id,away_team_id,home_score,away_score,round,source_event_key"
    )
    .eq("season_id", seasonId)
    .gte("match_date", isoFrom)
    .lte("match_date", isoTo)
    .order("match_date", { ascending: true });

  if (error) throw error;
  return (data || []) as DbMatchRow[];
}

function buildSourceEventKey(params: {
  compSlug: string;
  seasonName: string;
  matchDate: string;
  kickoffTime: string | null;
  homeName: string;
  awayName: string;
}) {
  return slugify(
    `${params.compSlug}|${params.seasonName}|${params.matchDate}|${params.kickoffTime || ""}|${params.homeName}|${params.awayName}`
  );
}

function dateDistanceDays(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.abs(d - now) / (1000 * 60 * 60 * 24);
}

function pickBestCandidate(possible: DbMatchRow[]) {
  return possible.slice().sort((a, b) => dateDistanceDays(a.match_date) - dateDistanceDays(b.match_date))[0];
}

function parseKickoffTime(raw: string): string | null {
  const s = raw || "";
  const m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  return `${hh}:${mm}:00`;
}

function inferMatchDateFromRawText(rawText: string, seasonName: string): string | null {
  const txt = rawText || "";
  const { startYear, endYear } = seasonYearBounds(seasonName);

  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  const m1 = txt.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\b/i);
  if (m1) {
    const mon = months[m1[1].slice(0, 3).toLowerCase()];
    const day = Number.parseInt(m1[2], 10);
    const year = mon >= 7 ? startYear : endYear;
    return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const m2 = txt.match(/\b(\d{1,2})\.(\d{1,2})\.?\b/);
  if (m2) {
    const day = Number.parseInt(m2[1], 10);
    const mon = Number.parseInt(m2[2], 10);
    const year = mon >= 7 ? startYear : endYear;
    return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const m3 = txt.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m3) {
    const mon = Number.parseInt(m3[1], 10);
    const day = Number.parseInt(m3[2], 10);
    const year = mon >= 7 ? startYear : endYear;
    return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

async function maybeAcceptConsent(page: Page) {
  const selectors = [
    'button:has-text("Aceptar")',
    'button:has-text("Acepto")',
    'button:has-text("I Agree")',
    'button:has-text("Agree")',
    '[data-testid="uc-accept-all-button"]',
    "#onetrust-accept-btn-handler",
  ];

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        break;
      }
    } catch {}
  }
}

async function gotoWithRetry(page: Page, url: string, tries = 3) {
  let lastErr: unknown = null;

  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      return;
    } catch (e) {
      lastErr = e;
      console.log(`WARN: goto failed (try ${i}/${tries}) -> ${url}`);
      await page.waitForTimeout(1500 * i).catch(() => {});
    }
  }

  throw lastErr;
}

async function clickShowMore(page: Page) {
  const selectors = [
    'a:has-text("Show more matches")',
    'button:has-text("Show more matches")',
    'a:has-text("Show more")',
    'button:has-text("Show more")',
    'a:has-text("Mostrar más")',
    'button:has-text("Mostrar más")',
  ];

  for (let i = 0; i < 8; i++) {
    let clicked = false;

    for (const sel of selectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click({ timeout: 1500 });
          await page.waitForTimeout(900);
          clicked = true;
          break;
        }
      } catch {}
    }

    if (!clicked) {
      try {
        await page.mouse.wheel(0, 2500);
        await page.waitForTimeout(500);
      } catch {}
    }
  }
}

async function scrapePage(page: Page) {
  const js = `
(() => {
  const pickText = (el) => (el ? el.innerText.trim() : "");

  const looksLikeDate = (txt) => {
    const s = (txt || "").trim();
    if (!s) return false;

    return (
      /\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}\\b/i.test(s) ||
      /\\b\\d{1,2}\\.\\d{1,2}\\.\\b/.test(s) ||
      /\\b\\d{1,2}\\/\\d{1,2}\\b/.test(s) ||
      /\\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\\b/i.test(s) ||
      /\\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\b/i.test(s)
    );
  };

  const findDateLabel = (row) => {
    let node = row;

    while (node) {
      let prev = node.previousElementSibling;

      while (prev) {
        const txt = pickText(prev);
        if (looksLikeDate(txt)) return txt;
        prev = prev.previousElementSibling;
      }

      node = node.parentElement;
    }

    return "";
  };

  const out = [];
  const rows = Array.from(
    document.querySelectorAll('[id^="g_"], .event__match, .event__row, [data-event-id], .event')
  );

  for (const r of rows) {
    const home =
      pickText(r.querySelector(".event__participant--home")) ||
      pickText(r.querySelector(".event__homeParticipant")) ||
      pickText((r.querySelectorAll(".event__participant")[0]) || null);

    const away =
      pickText(r.querySelector(".event__participant--away")) ||
      pickText(r.querySelector(".event__awayParticipant")) ||
      pickText((r.querySelectorAll(".event__participant")[1]) || null);

    if (!home || !away) continue;

    const hs =
      pickText(r.querySelector(".event__score--home")) ||
      pickText((r.querySelectorAll(".event__score")[0]) || null);

    const as =
      pickText(r.querySelector(".event__score--away")) ||
      pickText((r.querySelectorAll(".event__score")[1]) || null);

    const statusOrTime =
      pickText(r.querySelector(".event__time")) ||
      pickText(r.querySelector(".event__stage")) ||
      pickText(r.querySelector(".event__status"));

    const roundText =
      pickText(r.querySelector(".event__round")) ||
      pickText(r.querySelector(".event__subtitle")) ||
      "";

    const rawText = pickText(r);
    const dateLabel = findDateLabel(r);

    out.push({ home, away, hs, as, statusOrTime, roundText, rawText, dateLabel });
  }

  return out;
})()
`;
  return (await page.evaluate(js)) as ScrapedRow[];
}
function dedupeScrapedRows(rows: ScrapedRow[]) {
  const seen = new Set<string>();
  const out: ScrapedRow[] = [];

  for (const r of rows) {
    const key = [
      norm(r.home),
      norm(r.away),
      r.hs || "",
      r.as || "",
      r.statusOrTime || "",
      r.roundText || "",
      r.rawText || "",
    ].join("||");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

function buildExistingIndexes(matches: DbMatchRow[]) {
  const byTeams = new Map<string, DbMatchRow[]>();
  const bySourceKey = new Map<string, DbMatchRow>();

  for (const m of matches) {
    const key = `${m.home_team_id}__${m.away_team_id}`;
    const arr = byTeams.get(key) || [];
    arr.push(m);
    byTeams.set(key, arr);

    if (m.source_event_key) {
      bySourceKey.set(m.source_event_key, m);
    }
  }

  return { byTeams, bySourceKey };
}

async function saveMatchBySourceKey(payload: Record<string, unknown>) {
  const sourceEventKey = (payload.source_event_key as string | null) ?? null;
  const seasonId = payload.season_id as number;
  const matchDate = payload.match_date as string;
  const kickoffTime = (payload.kickoff_time as string | null) ?? null;
  const homeTeamId = payload.home_team_id as number;
  const awayTeamId = payload.away_team_id as number;

  if (sourceEventKey) {
    const { data: existingBySource, error: findSourceErr } = await supabase
      .from("matches")
      .select("id")
      .eq("source_event_key", sourceEventKey)
      .limit(1)
      .maybeSingle();

    if (findSourceErr) throw findSourceErr;

    if (existingBySource?.id) {
      const { error: updateErr } = await supabase
        .from("matches")
        .update(payload)
        .eq("id", existingBySource.id);

      if (updateErr) throw updateErr;
      return "updated";
    }
  }

  let logicalQuery = supabase
    .from("matches")
    .select("id")
    .eq("season_id", seasonId)
    .eq("match_date", matchDate)
    .eq("home_team_id", homeTeamId)
    .eq("away_team_id", awayTeamId)
    .limit(1);

  if (kickoffTime === null) {
    logicalQuery = logicalQuery.is("kickoff_time", null);
  } else {
    logicalQuery = logicalQuery.eq("kickoff_time", kickoffTime);
  }

  const { data: existingLogical, error: findLogicalErr } = await logicalQuery.maybeSingle();

  if (findLogicalErr) throw findLogicalErr;

  if (existingLogical?.id) {
    const { error: updateErr } = await supabase
      .from("matches")
      .update(payload)
      .eq("id", existingLogical.id);

    if (updateErr) throw updateErr;
    return "updated";
  }

  const { error: insertErr } = await supabase.from("matches").insert(payload);
  if (insertErr) throw insertErr;

  return "inserted";
}

async function main() {
  const inputs = urlsFromEnv();
  console.log("Inputs:", inputs);

  const { error: pingErr } = await supabase.from("competitions").select("id").limit(1);
  if (pingErr) throw pingErr;

  if (LIVE_ONLY) {
    const { data, error } = await supabase.from("matches").select("id").eq("status", "LIVE").limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      console.log("LIVE_ONLY=1 but no LIVE matches in DB. Exiting fast ✅");
      return;
    }
    console.log("LIVE match found in DB. Turbo sync running ⚡");
  }

  const { teamsMap, teamNamesNorm } = await getTeamsMap();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  });

  let totalUpdates = 0;
  let totalInsertedOrUpserted = 0;

  try {
    for (const item of inputs) {
      const compSlug = item.compSlug?.trim() || competitionSlugFromUrl(item.url);
      if (!compSlug) {
        console.log("Skip (unknown comp url):", item.url);
        continue;
      }

      const { seasonId, seasonName } = await getLatestSeasonIdByCompSlug(compSlug);
      const existingMatches = await getRecentMatchesBySeason(seasonId);
      const { byTeams, bySourceKey } = buildExistingIndexes(existingMatches);

      console.log(`\n== ${compSlug} (${seasonName}) ==`);
      console.log(`Existing matches in window: ${existingMatches.length}`);

      const variants = buildFlashVariants(item.url);
      let scrapedAll: ScrapedRow[] = [];

      for (const url of variants) {
        try {
          console.log("Open:", url);
          await gotoWithRetry(page, url, 3);
          await maybeAcceptConsent(page);

          try {
            await page.waitForSelector('[id^="g_"], .event__match, .event__row, [data-event-id], .event', {
              timeout: 20000,
            });
          } catch {
            console.log("WARN: selector not found quickly:", url);
          }

          await clickShowMore(page);
          await page.waitForTimeout(1200);

          const rows = dedupeScrapedRows(await scrapePage(page));
          console.log(`Scraped from ${url}:`, rows.length);
          scrapedAll.push(...rows);
        } catch (e) {
          console.log("WARN: failed scraping url:", url);
          console.log(e);
        }
      }

      const scraped = dedupeScrapedRows(scrapedAll);
      console.log("Scraped rows total (deduped):", scraped.length);

      let updatedHere = 0;
      let insertedHere = 0;
      const touchedIds = new Set<number>();
      const unresolvedTeams = new Set<string>();
      let skippedWithoutDate = 0;

      for (const row of scraped) {
        const homeId = await getOrCreateTeamId(row.home, teamsMap, teamNamesNorm);
        const awayId = await getOrCreateTeamId(row.away, teamsMap, teamNamesNorm);

        if (!homeId || !awayId) {
          unresolvedTeams.add(`${row.home} vs ${row.away}`);
          continue;
        }

        const parsed = detectStatusAndMinute(row.statusOrTime);
        const hs = parseScore(row.hs);
        const as = parseScore(row.as);
        const round = parseRound(row.roundText);

        let sourceKey: string | null = null;
        let target: DbMatchRow | null = null;

        const directKey = `${homeId}__${awayId}`;
        const reverseKey = `${awayId}__${homeId}`;

        const possible = byTeams.get(directKey) || byTeams.get(reverseKey) || [];
        if (possible.length > 0) {
          target = pickBestCandidate(possible);
        }

        const inferredDate =
        inferMatchDateFromRawText(row.dateLabel, seasonName) ||
       inferMatchDateFromRawText(row.rawText, seasonName);

        const matchDate = target?.match_date || inferredDate;

        if (!matchDate) {
  if (skippedWithoutDate < 10) {
    console.log("NO DATE:", {
      home: row.home,
      away: row.away,
      dateLabel: row.dateLabel,
      rawText: row.rawText,
    });
  }
  skippedWithoutDate++;
  continue;
}

        const kickoffTime = target?.kickoff_time || parseKickoffTime(row.rawText);

        sourceKey = buildSourceEventKey({
          compSlug,
          seasonName,
          matchDate,
          kickoffTime,
          homeName: row.home,
          awayName: row.away,
        });

        if (bySourceKey.has(sourceKey)) {
          target = bySourceKey.get(sourceKey)!;
        }

        const payload: Record<string, unknown> = {
          season_id: seasonId,
          match_date: matchDate,
          kickoff_time: kickoffTime,
          status: parsed.status,
          minute: parsed.minute,
          home_team_id: homeId,
          away_team_id: awayId,
          round: round ?? target?.round ?? null,
          source: "flashscore",
          source_event_key: sourceKey,
          source_url: normalizeFlashUrl(item.url),
          updated_at: new Date().toISOString(),
        };

        if (parsed.status === "NS") {
          payload.home_score = null;
          payload.away_score = null;
        } else {
          payload.home_score = hs;
          payload.away_score = as;
        }

        if (target?.id && !touchedIds.has(target.id)) {
          const patch: Record<string, unknown> = { ...payload };
          delete patch.season_id;
          delete patch.match_date;
          delete patch.kickoff_time;
          delete patch.home_team_id;
          delete patch.away_team_id;

          const { error } = await supabase.from("matches").update(patch).eq("id", target.id);

          if (error) {
            console.log(`WARN: update failed for id=${target.id}:`, error.message);
          } else {
            touchedIds.add(target.id);
            updatedHere++;
            totalUpdates++;
          }
        } else {
          try {
            const action = await saveMatchBySourceKey(payload);
            if (action === "updated") {
              updatedHere++;
              totalUpdates++;
            } else {
              insertedHere++;
              totalInsertedOrUpserted++;
            }
          } catch (e: any) {
            console.log("WARN: save by source_event_key failed:", e?.message || e);
          }
        }
      }

      if (unresolvedTeams.size > 0) {
        console.log(`Unresolved teams in ${compSlug}:`);
        for (const s of Array.from(unresolvedTeams).slice(0, 20)) {
          console.log(" -", s);
        }
      }

      if (skippedWithoutDate > 0) {
        console.log(`Skipped without inferable date in ${compSlug}: ${skippedWithoutDate}`);
      }

      console.log(`Updated in ${compSlug}: ${updatedHere}`);
      console.log(`Inserted/upserted in ${compSlug}: ${insertedHere}`);
    }
  } finally {
    await browser.close();
  }

  console.log("\nTOTAL updated matches:", totalUpdates);
  console.log("TOTAL inserted/upserted matches:", totalInsertedOrUpserted);
  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("ERROR ❌", e);
  process.exit(1);
});