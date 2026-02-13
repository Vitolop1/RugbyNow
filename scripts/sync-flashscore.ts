import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

type MatchStatus = "NS" | "LIVE" | "FT";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FLASH_URLS = process.env.FLASH_URLS!; // GitHub variable (multiline)

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
    .replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseScore(x: string) {
  const t = (x || "").trim();
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

function detectStatusAndMinute(raw: string) {
  const s = (raw || "").toUpperCase().trim();

  if (s.includes("FT") || s.includes("FINAL")) return { status: "FT" as MatchStatus, minute: null as number | null };

  // minutos tipo: 52' o 52
  const m = s.match(/(\d{1,3})\s*'?/);
  if (m && s.includes("'")) return { status: "LIVE" as MatchStatus, minute: parseInt(m[1], 10) };

  // HT / 1st / 2nd etc.
  if (s.includes("HT") || s.includes("LIVE")) return { status: "LIVE" as MatchStatus, minute: null as number | null };

  return { status: "NS" as MatchStatus, minute: null as number | null };
}

function urlsFromEnv() {
  return FLASH_URLS.split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function competitionSlugFromUrl(url: string) {
  // tus slugs en DB:
  // top14, sra, serie-a-elite, six-nations
  const u = url.toLowerCase();

  if (u.includes("/francia/top-14")) return "top14";
  if (u.includes("/sudamerica/super-rugby-americas")) return "sra";
  if (u.includes("/italia/serie-a-elite")) return "serie-a-elite";
  if (u.includes("/europa/seis-naciones")) return "six-nations";

  return null;
}

async function getLatestSeasonIdByCompSlug(compSlug: string) {
  const { data: comp, error: compErr } = await supabase
    .from("competitions")
    .select("id")
    .eq("slug", compSlug)
    .maybeSingle();

  if (compErr || !comp?.id) throw new Error(`No competition found for slug=${compSlug}`);

  const { data: season, error: seasonErr } = await supabase
    .from("seasons")
    .select("id,name")
    .eq("competition_id", comp.id)
    .order("name", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonErr || !season?.id) throw new Error(`No season found for compSlug=${compSlug}`);

  return { seasonId: season.id as number, seasonName: season.name as string };
}

async function getTeamsMap() {
  const { data, error } = await supabase.from("teams").select("id,name");
  if (error) throw error;

  const map = new Map<string, number>();
  for (const t of data || []) map.set(norm((t as any).name), (t as any).id);
  return map;
}

async function getCandidates(seasonId: number) {
  // “C”: actualizamos solo los que NO están FT, y cerca de hoy (para no scrapear de más)
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 3);
  const to = new Date(today);
  to.setDate(to.getDate() + 7);

  const isoFrom = from.toISOString().slice(0, 10);
  const isoTo = to.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("matches")
    .select("id,match_date,kickoff_time,home_team_id,away_team_id,status,minute,home_score,away_score")
    .eq("season_id", seasonId)
    .gte("match_date", isoFrom)
    .lte("match_date", isoTo)
    .neq("status", "FT");

  if (error) throw error;
  return (data || []) as any[];
}

async function scrapeFixturesPage(page: any) {
  // intentamos ser robustos: flashscore cambia selectores, entonces agarramos varias opciones
  const rows = await page.evaluate(() => {
    const pickText = (el: Element | null) => (el ? (el as HTMLElement).innerText.trim() : "");
    const out: any[] = [];

    // filas de partidos suelen tener ids tipo g_1_xxx o clases event__match/event__row
    const candidates = Array.from(
      document.querySelectorAll(
        '[id^="g_"], .event__match, .event__row, [data-event-id], .event'
      )
    );

    for (const r of candidates) {
      const home =
        pickText(r.querySelector(".event__participant--home")) ||
        pickText(r.querySelector(".event__homeParticipant")) ||
        pickText(r.querySelectorAll(".event__participant")[0] || null);

      const away =
        pickText(r.querySelector(".event__participant--away")) ||
        pickText(r.querySelector(".event__awayParticipant")) ||
        pickText(r.querySelectorAll(".event__participant")[1] || null);

      if (!home || !away) continue;

      const hs =
        pickText(r.querySelector(".event__score--home")) ||
        pickText(r.querySelectorAll(".event__score")[0] || null);

      const as =
        pickText(r.querySelector(".event__score--away")) ||
        pickText(r.querySelectorAll(".event__score")[1] || null);

      const statusOrTime =
        pickText(r.querySelector(".event__time")) ||
        pickText(r.querySelector(".event__stage")) ||
        pickText(r.querySelector(".event__status"));

      out.push({ home, away, hs, as, statusOrTime });
    }

    return out;
  });

  return rows as Array<{ home: string; away: string; hs: string; as: string; statusOrTime: string }>;
}

async function main() {
  const urls = urlsFromEnv();
  console.log("URLs:", urls);

  // quick ping
  const { error: pingErr } = await supabase.from("competitions").select("id").limit(1);
  if (pingErr) throw pingErr;

  const teamsMap = await getTeamsMap();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let totalUpdates = 0;

  for (const url of urls) {
    const compSlug = competitionSlugFromUrl(url);
    if (!compSlug) {
      console.log("Skip (unknown comp url):", url);
      continue;
    }

    const { seasonId, seasonName } = await getLatestSeasonIdByCompSlug(compSlug);
    const candidates = await getCandidates(seasonId);

    console.log(`\n== ${compSlug} (${seasonName}) ==`);
    console.log(`Candidates to update: ${candidates.length}`);

    // index por home/away
    const index = new Map<string, any[]>();
    for (const m of candidates) {
      const key = `${m.home_team_id}__${m.away_team_id}`;
      const arr = index.get(key) || [];
      arr.push(m);
      index.set(key, arr);
    }

    await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1500);

    const scraped = await scrapeFixturesPage(page);
    console.log("Scraped rows:", scraped.length);

    let updatedHere = 0;

    for (const row of scraped) {
      const homeId = teamsMap.get(norm(row.home));
      const awayId = teamsMap.get(norm(row.away));
      if (!homeId || !awayId) continue;

      const key = `${homeId}__${awayId}`;
      const possible = index.get(key);
      if (!possible || possible.length === 0) continue;

      // elegimos el primero (en la ventana de fechas que traemos suele ser único)
      const target = possible[0];

      const hs = parseScore(row.hs);
      const as = parseScore(row.as);
      const { status, minute } = detectStatusAndMinute(row.statusOrTime);

      // No pisemos con null si no hay score
      const patch: any = {
        status,
        minute,
        updated_at: new Date().toISOString(),
      };
      if (hs !== null) patch.home_score = hs;
      if (as !== null) patch.away_score = as;

      const { error } = await supabase.from("matches").update(patch).eq("id", target.id);
      if (!error) {
        updatedHere++;
        totalUpdates++;
      }
    }

    console.log(`Updated in ${compSlug}:`, updatedHere);
  }

  await browser.close();

  console.log("\nTOTAL updated matches:", totalUpdates);
  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("ERROR ❌", e);
  process.exit(1);
});
