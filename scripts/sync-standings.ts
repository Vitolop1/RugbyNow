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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ✅ NUEVO: standings URLs
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

// ⚠️ IMPORTANTE: NO BORRAMOS HASH
function normalizeStandingsUrl(raw: string) {
  const u = new URL(raw.trim());
  u.search = "";
  // u.hash SE DEJA TAL CUAL
  return u.toString();
}

function competitionSlugFromUrl(url: string) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  // rugby-union / france / top-14 / standings /
  if (parts.length < 4) return null;
  if (parts[0] !== "rugby-union") return null;

  const compSlug = parts[2];

  // Mapeo a tus slugs en Supabase:
  if (compSlug === "top-14") return "fr-top14";
  if (compSlug === "super-rugby-americas") return "sra";
  if (compSlug === "serie-a-elite") return "it-serie-a-elite";
  if (compSlug === "six-nations") return "int-six-nations";
  if (compSlug === "premiership-rugby") return "en-premiership"; // ✅ agrego esto

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
      await page.waitForTimeout(1500 * i).catch(() => {});
    }
  }
  throw lastErr;
}

async function scrapeStandings(page: Page): Promise<StandingRow[]> {
  // Esperamos algo de la tabla (Flashscore a veces tarda)
  await page.waitForTimeout(1500);

  const js = `
(() => {
  const text = (el) => (el ? (el.textContent || "").trim() : "");
  const toInt = (s) => {
    const t = (s || "").replace(/[^0-9-]/g, "").trim();
    if (!t) return 0;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : 0;
  };

  // rows candidates
  const rowSelectors = [
    ".ui-table__row",
    ".table__row",
    "[data-testid='wcl-tableRow']",
    "div[class*='table__row']",
    "div[class*='ui-table__row']",
  ];

  let rows = [];
  for (const sel of rowSelectors) {
    const found = Array.from(document.querySelectorAll(sel));
    if (found.length > 3) { rows = found; break; }
  }

  rows = rows.filter(r => (r.textContent || "").trim().length > 10);

  const teamSelectors = [
    ".tableCellParticipant__name",
    "a[href*='/team/']",
    "a[href*='/rugby-union/']",
  ];

  const pickTeam = (row) => {
    for (const sel of teamSelectors) {
      const el = row.querySelector(sel);
      const t = text(el);
      if (t) return t;
    }
    return "";
  };

  const pickCells = (row) => {
    let cells = Array.from(row.querySelectorAll(".ui-table__cell, .table__cell"));
    if (cells.length >= 6) return cells;
    cells = Array.from(row.children);
    return cells;
  };

  const out = [];
  for (const row of rows) {
    const cells = pickCells(row);
    if (!cells || cells.length < 6) continue;

    const rawTexts = cells.map(c => text(c)).filter(Boolean);
    if (rawTexts.length < 6) continue;

    // position
    let pos = 0;
    for (const s of rawTexts.slice(0, 3)) {
      const n = toInt(s);
      if (n > 0) { pos = n; break; }
    }
    if (!pos) continue;

    const team = pickTeam(row);
    if (!team) continue;

    const nums = rawTexts.map(toInt);

    const points = nums[nums.length - 1] ?? 0;

    let played=0, won=0, drawn=0, lost=0, pf=0, pa=0, diff=0, bonus=0;

    if (nums.length >= 11) {
      played = nums[2]; won = nums[3]; drawn = nums[4]; lost = nums[5];
      pf = nums[6]; pa = nums[7]; diff = nums[8]; bonus = nums[9];
    } else if (nums.length >= 9) {
      played = nums[2]; won = nums[3]; drawn = nums[4]; lost = nums[5];
      pf = nums[6] ?? 0; pa = nums[7] ?? 0;
      diff = nums[8] ?? (pf - pa);
      bonus = 0;
    } else {
      played = nums[2] ?? 0;
      won = nums[3] ?? 0;
      drawn = nums[4] ?? 0;
      lost = nums[5] ?? 0;
      pf = 0; pa = 0; diff = 0; bonus = 0;
    }

    out.push({
      position: pos,
      teamName: team,
      played, won, drawn, lost,
      pointsFor: pf,
      pointsAgainst: pa,
      diff: diff || (pf - pa),
      bonusPoints: bonus,
      points,
    });
  }

  out.sort((a,b) => a.position - b.position);
  return out;
})()
`;
  return (await page.evaluate(js)) as StandingRow[];
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

  const best = seasons.slice().sort((a, b) => (b.name || "").localeCompare(a.name || ""))[0];
  return { seasonId: best.id as number, seasonName: best.name as string };
}

async function resolveTeamIdByName(teamName: string): Promise<number | null> {
  const n = norm(teamName);
  if (!n) return null;

  const { data, error } = await supabase.from("teams").select("id,name");
  if (error) throw error;

  for (const t of data || []) {
    if (norm((t as any).name) === n) return (t as any).id as number;
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

      // Simple: delete+insert (como tu tabla no tiene UNIQUE)
      const { error: delErr } = await supabase.from("standings").delete().eq("season_id", seasonId);
      if (delErr) throw delErr;

      const inserts: any[] = [];
      for (const r of rows) {
        const teamId = await resolveTeamIdByName(r.teamName);
        if (!teamId) {
          console.log("Unmapped team in standings:", r.teamName);
          continue;
        }

        inserts.push({
          season_id: seasonId,
          team_id: teamId,
          played: r.played,
          won: r.won,
          drawn: r.drawn,
          lost: r.lost,
          points_for: r.pointsFor,
          points_against: r.pointsAgainst,
          diff: r.diff,
          tries_for: 0,
          tries_against: 0,
          bonus_points: r.bonusPoints,
          points: r.points,
          updated_at: new Date().toISOString(),
        });
      }

      if (inserts.length === 0) {
        console.log("No mapped teams to insert. Skipping.");
        continue;
      }

      const { error: insErr } = await supabase.from("standings").insert(inserts);
      if (insErr) throw insErr;

      console.log("Inserted standings:", inserts.length);
    }
  } finally {
    await browser.close();
  }

  console.log("\nDONE ✅ standings sync");
}

main().catch((e) => {
  console.error("ERROR ❌", e);
  process.exit(1);
});