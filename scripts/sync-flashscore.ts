import { createClient } from "@supabase/supabase-js";
import { chromium, Page } from "playwright";

type MatchStatus = "NS" | "LIVE" | "FT";

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

function parseScore(x: string) {
  const t = (x || "").trim().replace("–", "-");
  if (t === "-" || t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

function detectStatusAndMinute(raw: string) {
  const s = (raw || "").toUpperCase().trim();

  // postponed/cancelled/abandoned -> treat as NS
  if (/(POSTP|CANC|CANCEL|ABAND|ABD)/.test(s)) {
    return { status: "NS" as MatchStatus, minute: null as number | null };
  }

  if (/(FT|FINAL|AET)/.test(s)) {
    return { status: "FT" as MatchStatus, minute: null as number | null };
  }

  // LIVE markers
  if (/(HT|LIVE)/.test(s)) {
    return { status: "LIVE" as MatchStatus, minute: null as number | null };
  }

  // minute like 12'
  const m = s.match(/\b(\d{1,3})\s*'\b/);
  if (m) return { status: "LIVE" as MatchStatus, minute: Number.parseInt(m[1], 10) };

  // otherwise pre-match
  return { status: "NS" as MatchStatus, minute: null as number | null };
}

/**
 * FLASH_URLS supports:
 * - plain urls (old mode)
 * - or "slug=url" per line (recommended)
 *
 * Example:
 * fr-top14=https://www.flashscore.es/rugby-union/francia/top-14/...
 * en-premiership=https://www.flashscore.es/rugby-union/inglaterra/premiership/...
 */
function urlsFromEnv(): Array<{ compSlug: string | null; url: string }> {
  const tokens = FLASH_URLS!.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);

  const out: Array<{ compSlug: string | null; url: string }> = [];
  for (const tok of tokens) {
    if (tok.includes("=")) {
      const [slugRaw, urlRaw] = tok.split("=").map((x) => x.trim());
      out.push({ compSlug: slugRaw || null, url: urlRaw });
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

  let path = u.pathname.replace(/\/+$/, "");
  path = path.replace(/\/fixtures$/, "");
  u.pathname = path;

  return u.toString();
}

function competitionSlugFromUrl(url: string) {
  const normalized = normalizeFlashUrl(url);
  const u = new URL(normalized);

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 3) return null;

  // expected: /rugby-union/<region-or-country>/<competition>/...
  if (parts[0] !== "rugby-union") return null;

  const regionOrCountry = parts[1]; // e.g. europe, italy, france, south-america
  const compSlug = parts[2];        // e.g. six-nations, serie-a-elite, top-14

  if (compSlug === "top-14") return "fr-top14";
  if (compSlug === "serie-a-elite") return "it-serie-a-elite";
  if (compSlug === "six-nations") return "int-six-nations";
  if (compSlug === "super-rugby-americas") return "sra";

  // extras (for future)
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

async function getLatestSeasonIdByCompSlug(compSlug: string) {
  const { data: comp, error: compErr } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", compSlug)
    .maybeSingle();

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
    .sort((a, b) => seasonSortKey((b as any).name) - seasonSortKey((a as any).name))[0] as any;

  return { seasonId: best.id as number, seasonName: best.name as string };
}

async function getTeamsMap() {
  const { data, error } = await supabase.from("teams").select("id,name");
  if (error) throw error;

  const map = new Map<string, number>();
  const names: string[] = [];

  for (const t of data || []) {
    const n = norm((t as any).name);
    map.set(n, (t as any).id);
    names.push(n);
  }

  // ---- aliases (keep your existing ones) ----
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

async function getCandidates(seasonId: number) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 3);
  const to = new Date(today);
  to.setDate(to.getDate() + 7);

  const isoFrom = from.toISOString().slice(0, 10);
  const isoTo = to.toISOString().slice(0, 10);

  const q = supabase
    .from("matches")
    .select("id,match_date,kickoff_time,home_team_id,away_team_id,status,minute,home_score,away_score")
    .eq("season_id", seasonId)
    .gte("match_date", isoFrom)
    .lte("match_date", isoTo)
    .neq("status", "FT");

  const { data, error } = LIVE_ONLY ? await q.eq("status", "LIVE") : await q;

  if (error) throw error;
  return (data || []) as any[];
}

function dateDistanceDays(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.abs(d - now) / (1000 * 60 * 60 * 24);
}

function pickBestCandidate(possible: any[]) {
  return possible.slice().sort((a, b) => dateDistanceDays(a.match_date) - dateDistanceDays(b.match_date))[0];
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
  let lastErr: any = null;

  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      return;
    } catch (e) {
      lastErr = e;
      console.log(`WARN: goto failed (try ${i}/${tries}) -> ${url}`);
      try {
        await page.waitForTimeout(1500 * i);
      } catch {}
    }
  }

  throw lastErr;
}

async function scrapeFixturesPage(page: Page) {
  const js = `
(() => {
  const pickText = (el) => (el ? el.innerText.trim() : "");
  const out = [];

  const candidates = Array.from(
    document.querySelectorAll('[id^="g_"], .event__match, .event__row, [data-event-id], .event')
  );

  for (const r of candidates) {
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

    out.push({ home, away, hs, as, statusOrTime });
  }

  return out;
})()
`;
  return (await page.evaluate(js)) as Array<{
    home: string;
    away: string;
    hs: string;
    as: string;
    statusOrTime: string;
  }>;
}

function dedupeScrapedRows(
  rows: Array<{ home: string; away: string; hs: string; as: string; statusOrTime: string }>
) {
  const seen = new Set<string>();
  const out: typeof rows = [];

  for (const r of rows) {
    const key =
      norm(r.home) +
      "||" +
      norm(r.away) +
      "||" +
      (r.hs || "") +
      "||" +
      (r.as || "") +
      "||" +
      (r.statusOrTime || "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

async function main() {
  const inputs = urlsFromEnv();
  console.log("Inputs:", inputs);

  const { error: pingErr } = await supabase.from("competitions").select("id").limit(1);
  if (pingErr) throw pingErr;

  // If LIVE_ONLY and no LIVE matches in DB -> skip opening Playwright
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
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  });

  let totalUpdates = 0;

  try {
    for (const item of inputs) {
      const normalized = normalizeFlashUrl(item.url);

      const compSlug = item.compSlug?.trim() || competitionSlugFromUrl(item.url);
      if (!compSlug) {
        console.log("Skip (unknown comp url):", item.url, "->", normalized);
        continue;
      }

      const { seasonId, seasonName } = await getLatestSeasonIdByCompSlug(compSlug);
      const candidates = await getCandidates(seasonId);

      console.log(`\n== ${compSlug} (${seasonName}) ==`);
      console.log(`Candidates to update: ${candidates.length}`);
      if (candidates.length === 0) continue;

      const index = new Map<string, any[]>();
      for (const m of candidates) {
        const key = `${m.home_team_id}__${m.away_team_id}`;
        const arr = index.get(key) || [];
        arr.push(m);
        index.set(key, arr);
      }

      try {
        await gotoWithRetry(page, normalized, 3);
      } catch (e) {
        console.log("ERROR: could not load url after retries, skipping:", normalized);
        console.log(e);
        continue;
      }

      await maybeAcceptConsent(page);

      try {
        await page.waitForSelector('[id^="g_"], .event__match, .event__row, [data-event-id], .event', {
          timeout: 25000,
        });
      } catch {
        console.log("WARN: selector not found quickly, continuing anyway:", normalized);
      }

      await page.waitForTimeout(1200);

      let scraped = await scrapeFixturesPage(page);
      scraped = dedupeScrapedRows(scraped);

      console.log("Scraped rows (deduped):", scraped.length);

      let updatedHere = 0;
      const updatedIds = new Set<number>();

      for (const row of scraped) {
        const homeId = resolveTeamId(row.home, teamsMap, teamNamesNorm);
        const awayId = resolveTeamId(row.away, teamsMap, teamNamesNorm);
        if (!homeId || !awayId) continue;

        // try normal then reversed
        let key = `${homeId}__${awayId}`;
        let possible = index.get(key);

        if (!possible || possible.length === 0) {
          key = `${awayId}__${homeId}`;
          possible = index.get(key);
        }
        if (!possible || possible.length === 0) continue;

        const target = pickBestCandidate(possible);
        if (!target?.id) continue;
        if (updatedIds.has(target.id)) continue;
        updatedIds.add(target.id);

        const hs = parseScore(row.hs);
        const as = parseScore(row.as);
        const { status, minute } = detectStatusAndMinute(row.statusOrTime);

        // build patch safely
        const patch: any = { status, minute, updated_at: new Date().toISOString() };

        // If NS, clear scores (prevents fake "0-0")
        if (status === "NS") {
          patch.home_score = null;
          patch.away_score = null;
        } else {
          if (hs !== null) patch.home_score = hs;
          if (as !== null) patch.away_score = as;
        }

        const { error } = await supabase.from("matches").update(patch).eq("id", target.id);
        if (!error) {
          updatedHere++;
          totalUpdates++;
        }
      }

      console.log(`Updated in ${compSlug}:`, updatedHere);
    }
  } finally {
    await browser.close();
  }

  console.log("\nTOTAL updated matches:", totalUpdates);
  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("ERROR ❌", e);
  process.exit(1);
});