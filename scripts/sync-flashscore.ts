import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FLASH_URLS = process.env.FLASH_URLS!; // viene de GitHub Variables

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FLASH_URLS) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLASH_URLS");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function scrapeOne(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);

  const title = await page.title();

  await browser.close();
  return { url, title };
}

async function main() {
  // FLASH_URLS: separadas por coma
const urls = FLASH_URLS
  .split(/\r?\n|,/)
  .map((s) => s.trim())
  .filter(Boolean);

  console.log("URLs:", urls);

  // prueba Supabase
  const { data: ping, error: pingErr } = await supabase.from("competitions").select("id").limit(1);
  if (pingErr) throw pingErr;
  console.log("Supabase OK. competitions sample:", ping);

  // prueba scraping
  for (const u of urls) {
    const r = await scrapeOne(u);
    console.log("Scrape OK:", r.url, "->", r.title);
  }

  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("ERROR ❌", e);
  process.exit(1);
});
