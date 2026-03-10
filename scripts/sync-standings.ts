import { createClient } from "@supabase/supabase-js";
import { chromium, Page } from "playwright";

type StandingRow = {
  position: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  bonusPoints: number;
  points: number;
};

type TeamRow = {
  id: number;
  name: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STANDINGS_URLS = process.env.STANDINGS_URLS;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STANDINGS_URLS) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STANDINGS_URLS");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function urlsFromEnv(multiline: string) {
  return multiline
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeStandingsUrl(raw: string) {
  const url = new URL(raw.trim());
  url.search = "";
  return url.toString();
}

function competitionSlugFromUrl(url: string) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[0] !== "rugby-union") return null;

  const compSlug = parts[2];
  if (compSlug === "top-14") return "fr-top14";
  if (compSlug === "super-rugby-americas") return "sra";
  if (compSlug === "serie-a-elite") return "it-serie-a-elite";
  if (compSlug === "six-nations") return "int-six-nations";
  if (compSlug === "premiership-rugby") return "en-premiership-rugby";
  return null;
}

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function maybeAcceptConsent(page: Page) {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("I Agree")',
    'button:has-text("Agree")',
    'button:has-text("Aceptar")',
    'button:has-text("Acepto")',
    '[data-testid="uc-accept-all-button"]',
    "#onetrust-accept-btn-handler",
  ];

  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        break;
      }
    } catch {}
  }
}

async function gotoWithRetry(page: Page, url: string, tries = 3) {
  let lastError: unknown = null;

  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      return;
    } catch (error) {
      lastError = error;
      console.log(`WARN: goto failed (try ${i}/${tries}) -> ${url}`);
      await page.waitForTimeout(1500 * i).catch(() => {});
    }
  }

  throw lastError;
}

async function scrapeStandings(page: Page): Promise<StandingRow[]> {
  await page.waitForTimeout(1500);

  const script = `
(() => {
  const text = (el) => (el ? (el.textContent || "").trim() : "");
  const toInt = (s) => {
    const t = (s || "").replace(/[^0-9-]/g, "").trim();
    if (!t) return 0;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const rowSelectors = [
    ".ui-table__row",
    ".table__row",
    "[data-testid='wcl-tableRow']",
    "div[class*='table__row']",
    "div[class*='ui-table__row']",
  ];

  let rows = [];
  for (const selector of rowSelectors) {
    const found = Array.from(document.querySelectorAll(selector));
    if (found.length > 3) {
      rows = found;
      break;
    }
  }

  rows = rows.filter((row) => (row.textContent || "").trim().length > 10);

  const teamSelectors = [
    ".tableCellParticipant__name",
    "a[href*='/team/']",
    "a[href*='/rugby-union/']",
  ];

  const pickTeam = (row) => {
    for (const selector of teamSelectors) {
      const team = text(row.querySelector(selector));
      if (team) return team;
    }
    return "";
  };

  const pickCells = (row) => {
    let cells = Array.from(row.querySelectorAll(".ui-table__cell, .table__cell"));
    if (cells.length >= 6) return cells;
    return Array.from(row.children);
  };

  const out = [];
  for (const row of rows) {
    const cells = pickCells(row);
    if (!cells || cells.length < 6) continue;

    const rawTexts = cells.map((cell) => text(cell)).filter(Boolean);
    if (rawTexts.length < 6) continue;

    let position = 0;
    for (const value of rawTexts.slice(0, 3)) {
      const parsed = toInt(value);
      if (parsed > 0) {
        position = parsed;
        break;
      }
    }

    const teamName = pickTeam(row);
    if (!position || !teamName) continue;

    const numbers = rawTexts.map(toInt);
    const points = numbers[numbers.length - 1] ?? 0;

    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    let diff = 0;
    let bonusPoints = 0;

    if (numbers.length >= 11) {
      played = numbers[2];
      won = numbers[3];
      drawn = numbers[4];
      lost = numbers[5];
      pointsFor = numbers[6];
      pointsAgainst = numbers[7];
      diff = numbers[8];
      bonusPoints = numbers[9];
    } else if (numbers.length >= 9) {
      played = numbers[2];
      won = numbers[3];
      drawn = numbers[4];
      lost = numbers[5];
      pointsFor = numbers[6] ?? 0;
      pointsAgainst = numbers[7] ?? 0;
      diff = numbers[8] ?? (pointsFor - pointsAgainst);
    } else {
      played = numbers[2] ?? 0;
      won = numbers[3] ?? 0;
      drawn = numbers[4] ?? 0;
      lost = numbers[5] ?? 0;
    }

    out.push({
      position,
      teamName,
      played,
      won,
      drawn,
      lost,
      pointsFor,
      pointsAgainst,
      diff,
      bonusPoints,
      points,
    });
  }

  out.sort((a, b) => a.position - b.position);
  return out;
})()
`;

  return (await page.evaluate(script)) as StandingRow[];
}

async function getLatestSeasonIdByCompSlug(compSlug: string) {
  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", compSlug)
    .maybeSingle();

  if (competitionError) throw competitionError;
  if (!competition?.id) throw new Error(`No competition found for slug=${compSlug}`);

  const { data: seasons, error: seasonsError } = await supabase
    .from("seasons")
    .select("id,name")
    .eq("competition_id", competition.id);

  if (seasonsError) throw seasonsError;
  if (!seasons || seasons.length === 0) throw new Error(`No seasons found for compSlug=${compSlug}`);

  const latest = seasons.slice().sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")))[0];
  return { seasonId: latest.id as number, seasonName: latest.name as string };
}

async function resolveTeamIdByName(teamName: string): Promise<number | null> {
  const normalized = norm(teamName);
  if (!normalized) return null;

  const { data, error } = await supabase.from("teams").select("id,name");
  if (error) throw error;

  for (const team of (data || []) as TeamRow[]) {
    if (norm(team.name) === normalized) return team.id;
  }

  return null;
}

async function main() {
  const urls = urlsFromEnv(STANDINGS_URLS!);
  console.log("STANDINGS URLs:", urls);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  });

  try {
    for (const rawUrl of urls) {
      const url = normalizeStandingsUrl(rawUrl);
      const compSlug = competitionSlugFromUrl(url);

      if (!compSlug) {
        console.log("Skip unknown standings url:", url);
        continue;
      }

      const { seasonId, seasonName } = await getLatestSeasonIdByCompSlug(compSlug);
      console.log(`\n== ${compSlug} (${seasonName}) ==`);
      console.log("Standings URL:", url);

      await gotoWithRetry(page, url, 3);
      await maybeAcceptConsent(page);

      const rows = await scrapeStandings(page);
      console.log("Scraped standings rows:", rows.length);

      if (rows.length === 0) {
        console.log("WARN: standings empty, skipping.");
        continue;
      }

      const { error: deleteError } = await supabase.from("standings").delete().eq("season_id", seasonId);
      if (deleteError) throw deleteError;

      const inserts: Array<Record<string, number | string>> = [];
      for (const row of rows) {
        const teamId = await resolveTeamIdByName(row.teamName);
        if (!teamId) {
          console.log("Unmapped team in standings:", row.teamName);
          continue;
        }

        inserts.push({
          season_id: seasonId,
          team_id: teamId,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          points_for: row.pointsFor,
          points_against: row.pointsAgainst,
          diff: row.diff,
          tries_for: 0,
          tries_against: 0,
          bonus_points: row.bonusPoints,
          points: row.points,
          updated_at: new Date().toISOString(),
        });
      }

      if (inserts.length === 0) {
        console.log("No mapped teams to insert. Skipping.");
        continue;
      }

      const { error: insertError } = await supabase.from("standings").insert(inserts);
      if (insertError) throw insertError;

      console.log("Inserted standings:", inserts.length);
    }
  } finally {
    await browser.close();
  }

  console.log("\nDONE standings sync");
}

main().catch((error) => {
  console.error("ERROR", error);
  process.exit(1);
});
