import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import {
  extractNorteRugbyDataFromCaption,
  looksLikeNorteGrandeCaption,
  type NorteRugbyInstagramMatch,
  type NorteRugbyInstagramPayload,
  type NorteRugbyInstagramStanding,
} from "../lib/norteRugbyInstagram";

const PROFILE_URL = "https://www.instagram.com/norterugby/";
const OUTPUT_PATH = path.join(process.cwd(), "data", "norte-rugby-instagram.json");
const MAX_POSTS = Number.parseInt(process.env.NORTE_RUGBY_MAX_POSTS || "8", 10);

function dedupeMatches(matches: NorteRugbyInstagramMatch[]) {
  const byKey = new Map<string, NorteRugbyInstagramMatch>();

  for (const match of matches) {
    const key = `${match.round ?? ""}|${match.home}|${match.away}`;
    byKey.set(key, match);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if ((a.round ?? 0) !== (b.round ?? 0)) return (a.round ?? 0) - (b.round ?? 0);
    return `${a.home}|${a.away}`.localeCompare(`${b.home}|${b.away}`);
  });
}

function pickBestStandings(sets: NorteRugbyInstagramStanding[][]) {
  return sets
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((rows) => rows.length > 0) ?? [];
}

async function collectRecentPostUrls(profilePage: import("playwright").Page) {
  return profilePage.evaluate((limit) => {
    const urls = Array.from(document.querySelectorAll('a[href*="/p/"]'))
      .map((anchor) => anchor.getAttribute("href") || "")
      .filter(Boolean)
      .map((href) => new URL(href, window.location.origin).toString());

    return Array.from(new Set(urls)).slice(0, limit);
  }, MAX_POSTS);
}

async function readPostText(page: import("playwright").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2_500);
  return page.evaluate(() => document.body.innerText || "");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-AR",
    viewport: { width: 1280, height: 1600 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  });

  const profilePage = await context.newPage();
  await profilePage.goto(PROFILE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await profilePage.waitForTimeout(4_000);

  const postUrls = await collectRecentPostUrls(profilePage);
  const postPage = await context.newPage();

  const aggregatedMatches: NorteRugbyInstagramMatch[] = [];
  const standingSets: NorteRugbyInstagramStanding[][] = [];
  const relevantPosts: string[] = [];

  for (const postUrl of postUrls) {
    const text = await readPostText(postPage, postUrl);
    if (!looksLikeNorteGrandeCaption(text)) continue;

    const parsed = extractNorteRugbyDataFromCaption(text);
    if (!parsed.matches.length && !parsed.standings.length) continue;

    relevantPosts.push(postUrl);
    aggregatedMatches.push(...parsed.matches);
    if (parsed.standings.length) standingSets.push(parsed.standings);

    console.log(
      `Norte Rugby ${postUrl} -> matches=${parsed.matches.length} standings=${parsed.standings.length} round=${parsed.round ?? "?"}`
    );
  }

  const payload: NorteRugbyInstagramPayload = {
    generatedAt: new Date().toISOString(),
    source: "instagram",
    profileUrl: PROFILE_URL,
    postUrls: relevantPosts,
    matches: dedupeMatches(aggregatedMatches),
    standings: pickBestStandings(standingSets),
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Saved Norte Rugby data -> ${OUTPUT_PATH}`);
  console.log(`Matches: ${payload.matches.length}`);
  console.log(`Standings: ${payload.standings.length}`);

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error("ERROR syncing Norte Rugby", error);
  process.exit(1);
});
