import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import playwright from "playwright";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function getActiveSeasonId(competitionId) {
  const { data, error } = await sb
    .from("seasons")
    .select("id,name")
    .eq("competition_id", competitionId)
    .order("name", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) throw new Error("No season for competition " + competitionId);
  return data.id;
}

function cleanText(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

async function scrapeStandings(url) {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });

  // espera a que aparezca la tabla (Flashscore es SPA)
  await page.waitForTimeout(1500);

  // Heurística: busca filas en la tabla de standings
  // (Flashscore cambia clases seguido; esto intenta ser robusto)
  const rows = await page.$$eval("div", (divs) => {
    const textContains = (el, t) => el && el.textContent && el.textContent.toLowerCase().includes(t);
    // intenta encontrar el bloque que tiene "PTS" y cerca tiene filas con equipos
    const candidates = divs.filter((d) => textContains(d, "pts") && d.textContent.length > 50);
    const root = candidates[0] || document.body;

    // busca filas por patrones (# + team + números)
    const all = Array.from(root.querySelectorAll("div")).map((x) => x.textContent || "");
    return all.slice(0, 1); // placeholder para no romper si cambia (se reemplaza abajo)
  });

  // Mejor: parsear por DOM real mirando "tr" si existe
  const table = await page.evaluate(() => {
    const out = [];

    // intenta "table"
    const t = document.querySelector("table");
    if (t) {
      const trs = Array.from(t.querySelectorAll("tbody tr"));
      for (const tr of trs) {
        const tds = Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").replace(/\s+/g, " ").trim());
        if (tds.length >= 5) out.push(tds);
      }
      if (out.length) return out;
    }

    // fallback: buscar filas “visuales”
    // Flashscore suele renderizar filas como div rows con el rank y el team name
    const possibleRows = Array.from(document.querySelectorAll("div")).filter((d) => {
      const tx = (d.textContent || "").trim();
      // una fila típica contiene rank + team + varios números
      return /^\d+\s+/.test(tx) && tx.split(/\s+/).length >= 6 && tx.length < 200;
    });

    for (const d of possibleRows.slice(0, 60)) {
      const tx = (d.textContent || "").replace(/\s+/g, " ").trim();
      out.push(tx.split(" "));
    }

    return out;
  });

  await browser.close();
  return table;
}

async function main() {
  // 1) traemos competitions con standings_url
  const { data: comps, error } = await sb
    .from("competitions")
    .select("id,slug,name,standings_url")
    .not("standings_url", "is", null);

  if (error) throw error;

  for (const c of comps) {
    const url = c.standings_url;
    console.log("\n==>", c.slug, c.name, url);

    const seasonId = await getActiveSeasonId(c.id);

    const rawRows = await scrapeStandings(url);

    // TODO: Ajustá este mapping según lo que devuelva tu liga.
    // Meta objetivo: rank, teamName, played, w, d, l, pf, pa, pts, bonus_points (si existe)
    const parsed = [];
    for (const r of rawRows) {
      // Si viene como array de strings
      const cells = Array.isArray(r) ? r.map(cleanText) : [];
      const joined = cells.join(" ");
      if (!joined) continue;

      // intentamos detectar rank al inicio
      const rank = parseInt(cells[0] || "", 10);
      if (!Number.isFinite(rank)) continue;

      // Esto es “best effort”. Cuando lo corras 1 vez, miramos el output y lo ajustamos a tu tabla real.
      // Para arrancar: guardamos team como “lo que sigue” y pts como el último número.
      const pts = parseInt(cells[cells.length - 1] || "", 10);
      const team = cells.slice(1, cells.length - 1).join(" ").trim();

      if (!team) continue;

      parsed.push({
        season_id: seasonId,
        rank,
        team_name_raw: team,
        points: Number.isFinite(pts) ? pts : 0,
        source_url: url,
        source_updated_at: new Date().toISOString(),
      });
    }

    console.log("rows parsed:", parsed.length);

    // 2) Map team_name_raw -> team_id en tu DB:
    // Recomendación: completar teams.flashscore_name con el nombre EXACTO de Flashscore
    // Por ahora intentamos match por name (case-insensitive)
    for (const row of parsed) {
      const { data: team, error: te } = await sb
        .from("teams")
        .select("id,name,flashscore_name")
        .ilike("name", row.team_name_raw)
        .limit(1)
        .maybeSingle();

      if (te || !team) continue;

      const up = {
        season_id: row.season_id,
        team_id: team.id,
        rank: row.rank,
        points: row.points,
        source_url: row.source_url,
        source_updated_at: row.source_updated_at,
      };

      // upsert by unique (season_id, team_id)
      const { error: ue } = await sb.from("standings").upsert(up, { onConflict: "season_id,team_id" });
      if (ue) console.log("upsert err:", ue.message);
    }

    console.log("done:", c.slug);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});