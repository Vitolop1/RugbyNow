import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

type MatchStatus = "NS" | "LIVE" | "FT";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FLASH_URLS = process.env.FLASH_URLS!;

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

/**
 * Aliases: nombres que te vienen desde Flashscore (ES / abreviados)
 * -> nombre canónico tal como está guardado en tu tabla teams (normalizado).
 *
 * IMPORTANT: Guardá las keys y values en formato "como se ve", nosotros hacemos norm() al final.
 */
const TEAM_ALIASES: Record<string, string> = {
  // Six Nations (Flashscore ES -> DB EN)
  Irlanda: "Ireland",
  Italia: "Italy",
  Escocia: "Scotland",
  Inglaterra: "England",
  Gales: "Wales",
  Francia: "France",

  // SRA (Flashscore a veces muestra corto)
  Cobras: "Cobras Brasil Rugby",
  Capibaras: "Capibaras XV",
  Peñarol: "Peñarol Rugby",
  "Pampas XV": "Pampas",

  // Serie A Elite (Italia)
  Emilia: "Valorugby Emilia",
  "Petrarca Padova": "Petrarca",
  "Rugby Lyons": "Lyons Piacenza",
};

function canonicalTeamKey(rawName: string) {
  const n = norm(rawName);
  const mapped = TEAM_ALIASES[rawName] || TEAM_ALIASES[n] || TEAM_ALIASES[n.toLowerCase()] || TEAM_ALIASES[n.trim()];
  // Si el alias existe, devolvemos el nombre mapeado normalizado; si no, devolvemos el original normalizado.
  return norm(mapped ?? rawName);
}

function parseScore(x: string) {
  const t = (x || "").trim().replace("–", "-");
  if (t === "-" || t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

function detectStatusAndMinute(raw: string) {
  const s = (raw || "").toUpperCase().trim();

  // Cancelled / postponed / abandoned -> no toques a LIVE
  if (/(POSTP|CANC|CANCEL|ABAND|ABD)/.test(s)) {
    return { status: "NS" as MatchStatus, minute: null as number | null };
  }

  // Full time (incl. AET)
  if (/(FT|FINAL|AET)/.test(s)) {
    return { status: "FT" as MatchStatus, minute: null as number | null };
  }

  // Half time / live
  if (/(HT|LIVE)/.test(s)) {
    return { status: "LIVE" as MatchStatus, minute: null as number | null };
  }

  // Minutes like 52'
  const m = s.match(/\b(\d{1,3})\s*'\b/);
  if (m) return { status: "LIVE" as MatchStatus, minute: parseInt(m[1], 10) };

  return { status: "NS" as MatchStatus, minute: null as number | null };
}

function urlsFromEnv() {
  return FLASH_URLS.split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function competitionSlugFromUrl(url: string) {
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

  // También metemos en el map las values de TEAM_ALIASES por si alguna vez vienen igualitas
  // (no es estrictamente necesario, pero ayuda).
  for (const [_k, v] of Object.entries(TEAM_ALIASES)) {
    const key = norm(v);
    // No pisamos si ya existe
    if (!map.has(key)) {
      // OJO: no tenemos el id acá si no está en teams, así que no agregamos.
      // Esto queda a propósito vacío.
    }
  }

  return map;
}

async function getCandidates(seasonId: number) {
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

function dateDistanceDays(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00Z").getTime();
  const now = Date.now();
  return Math.abs(d - now) / (1000 * 60 * 60 * 24);
}

function pickBestCandidate(possible: any[]) {
  return possible
    .slice()
    .sort((a, b) => dateDistanceDays(a.match_date) - dateDistanceDays(b.match_date))[0];
}

/**
 * Scrape con evaluate string
 */
async function scrapeFixturesPage(page: any) {
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
  const rows = await page.evaluate(js);
  return rows as Array<{ home: string; away: string; hs: string; as: string; statusOrTime: string }>;
}

function dedupeScrapedRows(
  rows: Array<{ home: string; away: string; hs: string; as: string; statusOrTime: string }>
) {
  const seen = new Set<string>();
  const out: typeof rows = [];

  for (const r of rows) {
    const key =
      norm(r.home) + "||" + norm(r.away) + "||" + (r.hs || "") + "||" + (r.as || "") + "||" + (r.statusOrTime || "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

async function main() {
  const urls = urlsFromEnv();
  console.log("URLs:", urls);

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

    // ✅ espera algo “match-like”
    try {
      await page.waitForSelector('[id^="g_"], .event__match, .event__row, [data-event-id], .event', { timeout: 15000 });
    } catch {
      console.log("WARN: selector not found quickly, continuing anyway:", url);
    }

    await page.waitForTimeout(800);

    let scraped = await scrapeFixturesPage(page);
    scraped = dedupeScrapedRows(scraped);

    console.log("Scraped rows (deduped):", scraped.length);

    // ✅ para diagnosticar alias
    const unmapped = new Map<string, number>();

    let updatedHere = 0;
    const updatedIds = new Set<number>(); // ✅ evita updates dobles por id

    for (const row of scraped) {
      // 🔥 acá está el fix: canonicalTeamKey()
      const homeKey = canonicalTeamKey(row.home);
      const awayKey = canonicalTeamKey(row.away);

      const homeId = teamsMap.get(homeKey);
      const awayId = teamsMap.get(awayKey);

      if (!homeId) unmapped.set(row.home, (unmapped.get(row.home) || 0) + 1);
      if (!awayId) unmapped.set(row.away, (unmapped.get(row.away) || 0) + 1);
      if (!homeId || !awayId) continue;

      const key = `${homeId}__${awayId}`;
      const possible = index.get(key);
      if (!possible || possible.length === 0) continue;

      const target = pickBestCandidate(possible);
      if (!target?.id) continue;

      if (updatedIds.has(target.id)) continue; // ✅ evita doble update
      updatedIds.add(target.id);

      const hs = parseScore(row.hs);
      const as = parseScore(row.as);
      const { status, minute } = detectStatusAndMinute(row.statusOrTime);

      const patch: any = { status, minute, updated_at: new Date().toISOString() };
      if (hs !== null) patch.home_score = hs;
      if (as !== null) patch.away_score = as;

      const { error } = await supabase.from("matches").update(patch).eq("id", target.id);
      if (!error) {
        updatedHere++;
        totalUpdates++;
      }
    }

    console.log(`Updated in ${compSlug}:`, updatedHere);

    // ✅ Log unmapped teams (clave para arreglar lo que falte)
    if (unmapped.size > 0) {
      const top = Array.from(unmapped.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
      console.log("Unmapped team names (top):", top);
    }
  }

  await browser.close();

  console.log("\nTOTAL updated matches:", totalUpdates);
  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("ERROR ❌", e);
  process.exit(1);
});
