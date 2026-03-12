import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, Page, Route } from "playwright";

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
  detailUrl: string | null;
  sourcePage: "results" | "fixtures" | "live";
};

type ScrapedStandingRow = {
  pos: number | null;
  team: string;
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
  pointsFor: number | null;
  pointsAgainst: number | null;
  points: number | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE_ONLY = process.env.LIVE_ONLY === "1";
const MATCHES_ONLY = process.env.MATCHES_ONLY === "1";
const STANDINGS_ONLY = process.env.STANDINGS_ONLY === "1";
const DRY_RUN = process.env.DRY_RUN === "1";

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const supabase =
  !DRY_RUN && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase client is not available. Run without DRY_RUN=1 to enable DB sync.");
  }

  return supabase;
}

function ensureLogsDir() {
  const dir = path.join(process.cwd(), "logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeDryRunDump(compSlug: string, payload: Record<string, unknown>) {
  const dir = ensureLogsDir();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `flashscore-dry-run-${compSlug}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  console.log(`DRY_RUN dump written: ${file}`);
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

function slugify(s: string) {
  return norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseScore(x: string) {
  const t = (x || "").trim().replace(/–/g, "-");
  if (t === "-" || t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

function parseRound(raw: string): number | null {
  const s = (raw || "").trim();
  if (!s) return null;

  const m1 = s.match(/\bround\s+(\d+)\b/i);
  if (m1) return Number.parseInt(m1[1], 10);

  const m2 = s.match(/\b(?:fecha|jornada|week)\s+(\d+)\b/i);
  if (m2) return Number.parseInt(m2[1], 10);

  const m3 = s.match(/\b(\d+)\b/);
  if (m3) return Number.parseInt(m3[1], 10);

  return null;
}

function detectStatusAndMinute(
  raw: string,
  hs: number | null,
  as: number | null,
  sourcePage: "results" | "fixtures" | "live"
) {
  const s = (raw || "").toUpperCase().trim();

  if (/(POSTP|CANC|CANCEL|ABAND|ABD|AWD|WO)/.test(s)) {
    return { status: "NS" as MatchStatus, minute: null as number | null };
  }

  if (/(FT|FINAL|AET|AFTER EXTRA TIME)/.test(s)) {
    return { status: "FT" as MatchStatus, minute: null as number | null };
  }

  if (/(HT|HALF TIME|LIVE|1ST HALF|2ND HALF|SECOND HALF|BREAK)/.test(s)) {
    return { status: "LIVE" as MatchStatus, minute: null as number | null };
  }

  const minuteMatch = s.match(/\b(\d{1,3})\s*'\b/);
  if (minuteMatch) {
    return {
      status: "LIVE" as MatchStatus,
      minute: Number.parseInt(minuteMatch[1], 10),
    };
  }

  if (sourcePage === "results" && hs !== null && as !== null) {
    return { status: "FT" as MatchStatus, minute: null as number | null };
  }

  const timeMatch = s.match(/\b\d{1,2}:\d{2}\b/);
  if (timeMatch) {
    return { status: "NS" as MatchStatus, minute: null as number | null };
  }

  return { status: "NS" as MatchStatus, minute: null as number | null };
}

function urlsFromEnv(): FlashInput[] {
  const raw = process.env.FLASH_URLS;

  if (!raw) {
    throw new Error("Missing env var: FLASH_URLS");
  }

  const tokens = raw
    .split(/\r?\n|,/)
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
  const base = original
    .replace(/\/fixtures$/i, "")
    .replace(/\/results$/i, "")
    .replace(/\/standings$/i, "");

  if (STANDINGS_ONLY) {
    return {
      resultsAndFixtures: [] as string[],
      standings: `${base}/standings`,
    };
  }

  if (LIVE_ONLY) {
    return {
      resultsAndFixtures: [`${base}/live`],
      standings: `${base}/standings`,
    };
  }

  return {
    resultsAndFixtures: [`${base}/results`, `${base}/fixtures`],
    standings: `${base}/standings`,
  };
}

function parseMatchDateTime(matchDate: string, kickoffTime?: string | null) {
  if (!matchDate) return null;
  const time = kickoffTime && kickoffTime.trim() ? kickoffTime.trim() : "00:00";
  const normalized = time.length === 5 ? `${time}:00` : time;
  const value = new Date(`${matchDate}T${normalized}`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isPotentiallyLiveWindow(matchDate: string, kickoffTime?: string | null, status?: MatchStatus | null) {
  if (status === "LIVE") return true;

  const kickoff = parseMatchDateTime(matchDate, kickoffTime);
  if (!kickoff) return false;

  const diffMinutes = Math.floor((Date.now() - kickoff.getTime()) / 60000);
  return diffMinutes >= -15 && diffMinutes <= 130;
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
  if (compSlug === "premiership-rugby") return "en-premiership-rugby";
  if (compSlug === "european-rugby-champions-cup") return "eu-champions-cup";
  if (compSlug === "world-cup") return "int-world-cup";
  if (compSlug === "nations-championship") return "int-nations-championship";
  if (compSlug === "super-rugby") return "int-super-rugby-pacific";
  if (compSlug === "united-rugby-championship") return "int-united-rugby-championship";
  if (compSlug === "major-league-rugby") return "us-mlr";
  if (compSlug === "svns-australia") return "svns-australia";
  if (compSlug === "svns-usa") return "svns-usa";
  if (compSlug === "svns-hong-kong") return "svns-hong-kong";
  if (compSlug === "svns-singapore") return "svns-singapore";

  if (regionOrCountry === "argentina" && compSlug === "top-14") {
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

async function getSeasonCandidatesByCompSlug(compSlug: string) {
  const { data: comp, error: compErr } = await ensureSupabase()
    .from("competitions")
    .select("id,slug,name")
    .eq("slug", compSlug)
    .maybeSingle<CompetitionRow>();

  if (compErr) throw compErr;
  if (!comp?.id) throw new Error(`No competition found for slug=${compSlug}`);

  const { data: seasons, error: seasonErr } = await ensureSupabase()
    .from("seasons")
    .select("id,name")
    .eq("competition_id", comp.id);

  if (seasonErr) throw seasonErr;
  if (!seasons || seasons.length === 0) throw new Error(`No seasons found for compSlug=${compSlug}`);

  return seasons
    .slice()
    .sort((a, b) => seasonSortKey(b.name) - seasonSortKey(a.name)) as SeasonRow[];
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Unknown error");
  }

  return String(error);
}

function pickSeasonForScrapedRows(seasons: SeasonRow[], rows: ScrapedRow[]) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();

  let best = seasons[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const season of seasons) {
    let score = 0;
    let parsedCount = 0;

    for (const row of rows) {
      const inferred =
        inferMatchDateFromRawText(row.dateLabel, season.name) ||
        inferMatchDateFromRawText(row.rawText, season.name);
      if (!inferred) continue;

      parsedCount += 1;
      const distanceDays = Math.abs(new Date(`${inferred}T00:00:00Z`).getTime() - nowMs) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 365 - distanceDays);

      if (inferred <= todayIso) {
        score += 20;
      }
    }

    score += parsedCount * 100;

    if (score > bestScore) {
      bestScore = score;
      best = season;
    }
  }

  return { seasonId: best.id, seasonName: best.name };
}

async function getTeamsMap() {
  const map = new Map<string, number>();
  const names: string[] = [];

  if (!DRY_RUN) {
    const { data, error } = await ensureSupabase().from("teams").select("id,name");
    if (error) throw error;
    for (const t of (data || []) as TeamRow[]) {
      const n = norm(t.name);
      map.set(n, t.id);
      names.push(n);
    }
  }

  map.set(norm("Emilia"), 33);
  map.set(norm("Valorugby"), 33);
  map.set(norm("Valorugby Emilia"), 33);

  map.set(norm("Petrarca Padova"), 31);
  map.set(norm("Petrarca"), 31);

  map.set(norm("Rugby Lyons"), 38);
  map.set(norm("Lyons"), 38);
  map.set(norm("Lyons Piacenza"), 38);

  map.set(norm("Aviron Bayonnais"), 51);
  map.set(norm("Bayonne"), 51);

  map.set(norm("RC Toulonnais"), 46);
  map.set(norm("Toulon"), 46);

  map.set(norm("Stade Francais Paris"), 45);
  map.set(norm("Stade Français Paris"), 45);
  map.set(norm("Stade Francais"), 45);
  map.set(norm("Stade Français"), 45);

  map.set(norm("Stade Rochelais"), 50);
  map.set(norm("Stade Toulousain"), 41);

  map.set(norm("ASM Clermont Auvergne"), 48);
  map.set(norm("Clermont"), 48);

  map.set(norm("Montpellier Hérault Rugby"), 44);
  map.set(norm("Montpellier Herault Rugby"), 44);
  map.set(norm("Montpellier"), 44);

  map.set(norm("Bordeaux Begles"), 43);
  map.set(norm("Bordeaux Bègles"), 43);
  map.set(norm("Union Bordeaux Bègles"), 43);

  map.set(norm("USA Perpignan"), 53);
  map.set(norm("Perpignan"), 53);

  map.set(norm("Castres"), 47);
  map.set(norm("Castres Olympique"), 47);

  map.set(norm("Racing"), 49);
  map.set(norm("Racing 92"), 49);

  map.set(norm("Lyon"), 52);
  map.set(norm("Montauban"), 54);
  map.set(norm("Section Paloise"), 42);

  map.set(norm("Glasgow"), 142);
  map.set(norm("Glasgow Warriors"), 142);

  map.set(norm("Stormers"), 146);
  map.set(norm("Sharks"), 147);
  map.set(norm("The Sharks"), 147);
  map.set(norm("Bulls"), 149);

  map.set(norm("Leinster"), 145);
  map.set(norm("Munster"), 144);
  map.set(norm("Scarlets"), 143);
  map.set(norm("Edinburgh"), 148);

  map.set(norm("Northampton"), 116);
  map.set(norm("Northampton Saints"), 116);

  map.set(norm("Leicester"), 118);
  map.set(norm("Leicester Tigers"), 118);

  map.set(norm("Exeter"), 119);
  map.set(norm("Exeter Chiefs"), 119);

  map.set(norm("Sale"), 115);
  map.set(norm("Sale Sharks"), 115);

  map.set(norm("Harlequins"), 117);
  map.set(norm("Saracens"), 121);
  map.set(norm("Bath"), 124);
  map.set(norm("Bristol"), 120);
  map.set(norm("Bristol Bears"), 120);
  map.set(norm("Gloucester"), 123);

  map.set(norm("Newcastle"), 122);
  map.set(norm("Newcastle Falcons"), 122);
  map.set(norm("Newcastle Red Bulls"), 122);

  map.set(norm("Fijian Drua"), 177);
  map.set(norm("Fiji Drua"), 177);

  map.set(norm("Force"), 172);
  map.set(norm("Western Force"), 172);

  map.set(norm("Blues"), 173);
  map.set(norm("Highlanders"), 174);
  map.set(norm("Chiefs"), 175);
  map.set(norm("Waratahs"), 176);
  map.set(norm("Hurricanes"), 178);
  map.set(norm("Moana Pasifika"), 179);
  map.set(norm("Reds"), 180);
  map.set(norm("Queensland Reds"), 180);
  map.set(norm("Crusaders"), 170);
  map.set(norm("Brumbies"), 171);
  map.set(norm("ACT Brumbies"), 171);

  map.set(norm("Cobras"), 9);
  map.set(norm("Cobras Brasil"), 9);
  map.set(norm("Cobras Brasil Rugby"), 9);

  map.set(norm("Capibaras"), 14);
  map.set(norm("Capibaras XV"), 14);

  map.set(norm("Pampas"), 193);
  map.set(norm("Pampas XV"), 193);

  map.set(norm("Penarol"), 7);
  map.set(norm("Peñarol"), 7);
  map.set(norm("Penarol Rugby"), 7);
  map.set(norm("Peñarol Rugby"), 7);

  map.set(norm("Dogos"), 11);
  map.set(norm("Dogos XV"), 11);

  map.set(norm("Yacare"), 10);
  map.set(norm("Yacare XV"), 10);

  map.set(norm("Tarucas"), 13);
  map.set(norm("Selknam"), 8);

  map.set(norm("Atl. Del Rosario"), 94);
  map.set(norm("Atletico del Rosario"), 94);
  map.set(norm("Atlético del Rosario"), 94);

  map.set(norm("CASI"), 90);
  map.set(norm("CUBA"), 88);
  map.set(norm("SIC"), 99);

  map.set(norm("Alumni"), 87);
  map.set(norm("Belgrano"), 100);
  map.set(norm("Belgrano Athletic"), 100);
  map.set(norm("Buenos Aires"), 98);
  map.set(norm("Champagnat"), 89);
  map.set(norm("Hindu"), 91);
  map.set(norm("Hindú"), 91);
  map.set(norm("La Plata"), 93);
  map.set(norm("Los Matreros"), 95);
  map.set(norm("Los Tilos"), 92);
  map.set(norm("Newman"), 97);
  map.set(norm("Regatas Bella Vista"), 96);

  map.set(norm("Seattle Seawolves"), 186);
  map.set(norm("Old Glory DC"), 187);
  map.set(norm("Chicago Hounds"), 188);
  map.set(norm("New England Free Jacks"), 189);
  map.set(norm("California Legion"), 184);
  map.set(norm("Anthem RC"), 185);

  map.set(norm("USA"), 194);
  map.set(norm("US"), 194);
  map.set(norm("U.S.A."), 194);
  map.set(norm("United States"), 194);
  map.set(norm("Estados Unidos"), 194);
  map.set(norm("EE UU"), 194);
  map.set(norm("EEUU"), 194);
  map.set(norm("EE. UU."), 194);

  map.set(norm("Fiji"), 165);
  map.set(norm("Fiyi"), 165);

  const nzId = map.get(norm("New Zealand"));
  if (nzId) map.set(norm("Nueva Zelanda"), nzId);

  const saId = map.get(norm("South Africa"));
  if (saId) {
    map.set(norm("Sudafrica"), saId);
    map.set(norm("Sudáfrica"), saId);
  }

  const scotlandId = map.get(norm("Scotland"));
  if (scotlandId) map.set(norm("Escocia"), scotlandId);

  const englandId = map.get(norm("England"));
  if (englandId) map.set(norm("Inglaterra"), englandId);

  const walesId = map.get(norm("Wales"));
  if (walesId) map.set(norm("Gales"), walesId);

  const japanId = map.get(norm("Japan"));
  if (japanId) {
    map.set(norm("Japon"), japanId);
    map.set(norm("Japón"), japanId);
  }

  const romaniaId = map.get(norm("Romania"));
  if (romaniaId) {
    map.set(norm("Rumania"), romaniaId);
    map.set(norm("Rumanía"), romaniaId);
  }

  const zimbabweId = map.get(norm("Zimbabwe"));
  if (zimbabweId) map.set(norm("Zimbabue"), zimbabweId);

  const franceId = map.get(norm("France"));
  if (franceId) map.set(norm("Francia"), franceId);

  const irelandId = map.get(norm("Ireland"));
  if (irelandId) map.set(norm("Irlanda"), irelandId);

  const italyId = map.get(norm("Italy"));
  if (italyId) map.set(norm("Italia"), italyId);

  const argentinaId = map.get(norm("Argentina"));
  if (argentinaId) map.set(norm("Arg"), argentinaId);

  const spainId = map.get(norm("Spain"));
  if (spainId) {
    map.set(norm("Espana"), spainId);
    map.set(norm("España"), spainId);
  }

  const belgiumId = map.get(norm("Belgium"));
  if (belgiumId) {
    map.set(norm("Belgica"), belgiumId);
    map.set(norm("Bélgica"), belgiumId);
  }

  const brazilId = map.get(norm("Brazil"));
  if (brazilId) map.set(norm("Brasil"), brazilId);

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

    if (candidate === n) score += 100;
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

  if (DRY_RUN) {
    const fakeId = -1 * (teamNamesNorm.length + 1);
    const n = norm(cleanName);
    teamsMap.set(n, fakeId);
    teamNamesNorm.push(n);
    return fakeId;
  }

  const { data, error } = await ensureSupabase()
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

async function getMatchesBySeason(seasonId: number) {
  const { data, error } = await ensureSupabase()
    .from("matches")
    .select(
      "id,season_id,match_date,kickoff_time,status,minute,home_team_id,away_team_id,home_score,away_score,round,source_event_key"
    )
    .eq("season_id", seasonId)
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

function dateDistanceDays(isoDate: string, referenceIsoDate?: string | null) {
  const d = new Date(`${isoDate}T00:00:00Z`).getTime();
  const ref = referenceIsoDate ? new Date(`${referenceIsoDate}T00:00:00Z`).getTime() : Date.now();
  return Math.abs(d - ref) / (1000 * 60 * 60 * 24);
}

function pickBestCandidate(possible: DbMatchRow[], referenceIsoDate?: string | null, kickoffTime?: string | null) {
  return possible
    .slice()
    .sort((a, b) => {
      const kickoffBonusA =
        kickoffTime && a.kickoff_time && a.kickoff_time.slice(0, 5) === kickoffTime.slice(0, 5) ? -0.5 : 0;
      const kickoffBonusB =
        kickoffTime && b.kickoff_time && b.kickoff_time.slice(0, 5) === kickoffTime.slice(0, 5) ? -0.5 : 0;
      const da = dateDistanceDays(a.match_date, referenceIsoDate) + kickoffBonusA;
      const db = dateDistanceDays(b.match_date, referenceIsoDate) + kickoffBonusB;
      if (da !== db) return da - db;
      if (a.status === "FT" && b.status !== "FT") return -1;
      if (b.status === "FT" && a.status !== "FT") return 1;
      return a.id - b.id;
    })[0];
}

function parseKickoffTime(raw: string): string | null {
  const s = raw || "";
  const m = s.match(/\b(\d{1,2}):(\d{2})(?:\s*([AP])\.?M?\.?)?\b/i);
  if (!m) return null;
  let hour = Number.parseInt(m[1], 10);
  const minute = m[2];
  const meridiem = m[3]?.toUpperCase() ?? null;
  if (meridiem === "P" && hour < 12) hour += 12;
  if (meridiem === "A" && hour === 12) hour = 0;
  const hh = String(hour).padStart(2, "0");
  return `${hh}:${minute}:00`;
}

function inferMatchDateFromRawText(rawText: string, seasonName: string): string | null {
  const txt = rawText || "";
  const { startYear, endYear } = seasonYearBounds(seasonName);

  const months: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
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

  for (let i = 0; i < 30; i++) {
    let clicked = false;

    for (const sel of selectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1200 })) {
          await btn.click({ timeout: 2000 });
          await page.waitForTimeout(1000);
          clicked = true;
          break;
        }
      } catch {}
    }

    try {
      await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(700);
    } catch {}

    if (!clicked && i > 8) {
      continue;
    }
  }
}

async function scrapePage(page: Page, sourcePage: "results" | "fixtures" | "live") {
  const js = `
(() => {
  const pickText = (el) => {
    if (!el) return "";
    return String(el.innerText ?? el.textContent ?? "").trim();
  };

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

    const statusOrTime = [
      pickText(r.querySelector(".event__time")),
      pickText(r.querySelector(".event__stage")),
      pickText(r.querySelector(".event__status")),
    ]
      .filter(Boolean)
      .join(" ");

    const roundText =
      pickText(r.querySelector(".event__round")) ||
      pickText(r.querySelector(".event__subtitle")) ||
      "";

    const rawText = pickText(r);
    const dateLabel = findDateLabel(r);
    const detailUrl =
      r.querySelector(".eventRowLink")?.getAttribute("href") ||
      r.querySelector("a[href*='/match/']")?.getAttribute("href") ||
      null;

    out.push({ home, away, hs, as, statusOrTime, roundText, rawText, dateLabel, detailUrl });
  }

  return out;
})()
`;

  const rows = (await page.evaluate(js)) as Omit<ScrapedRow, "sourcePage">[];
  return rows.map((r) => ({ ...r, sourcePage }));
}

async function scrapeStandingsPage(page: Page) {
  const js = `
(() => {
  const txt = (el) => {
    if (!el) return "";
    return String(el.innerText ?? el.textContent ?? "").trim();
  };

  const rows = Array.from(document.querySelectorAll(
    '.table__row, .ui-table__row, [class*="tableRow"], [class*="standing"] [class*="row"]'
  ));

  const out = [];

  for (const r of rows) {
    const rowText = txt(r);
    if (!rowText) continue;

    const team =
      txt(r.querySelector('[class*="participant"]')) ||
      txt(r.querySelector('[class*="team"]')) ||
      txt(r.querySelector('a'));

    if (!team) continue;

    const cells = Array.from(r.querySelectorAll('div, span'))
      .map((x) => txt(x))
      .filter(Boolean);

    const nums = cells
      .map((v) => {
        const m = v.match(/^\\d+$/);
        return m ? parseInt(v, 10) : null;
      })
      .filter((v) => v != null);

    let pos = null;
    const posEl =
      r.querySelector('[class*="rank"]') ||
      r.querySelector('[class*="position"]');

    if (posEl) {
      const p = txt(posEl).match(/\\d+/);
      pos = p ? parseInt(p[0], 10) : null;
    } else {
      const m = rowText.match(/^\\s*(\\d+)\\s/);
      pos = m ? parseInt(m[1], 10) : null;
    }

    out.push({
      pos,
      team,
      nums,
      raw: rowText,
    });
  }

  return out;
})()
`;

  const raw = (await page.evaluate(js)) as Array<{
    pos: number | null;
    team: string;
    nums: number[];
    raw: string;
  }>;

  const cleaned: ScrapedStandingRow[] = [];

  for (const r of raw) {
    if (!r.team) continue;

    let played: number | null = null;
    let won: number | null = null;
    let drawn: number | null = null;
    let lost: number | null = null;
    let pointsFor: number | null = null;
    let pointsAgainst: number | null = null;
    let points: number | null = null;

    const compact = r.raw.replace(/\s+/g, " ").trim();
    const structured =
      compact.match(/^\s*\d+\.\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+):(\d+)\s+(-?\d+)\b/) ||
      compact.match(/^\s*(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+):(\d+)\s+(-?\d+)\b/);

    if (structured) {
      played = Number.parseInt(structured[2], 10);
      won = Number.parseInt(structured[3], 10);
      drawn = Number.parseInt(structured[4], 10);
      lost = Number.parseInt(structured[5], 10);
      pointsFor = Number.parseInt(structured[6], 10);
      pointsAgainst = Number.parseInt(structured[7], 10);
      points = Number.parseInt(structured[8], 10);
    } else if (r.nums.length >= 7) {
      played = r.nums[0] ?? null;
      won = r.nums[1] ?? null;
      drawn = r.nums[2] ?? null;
      lost = r.nums[3] ?? null;
      pointsFor = r.nums[4] ?? null;
      pointsAgainst = r.nums[5] ?? null;
      points = r.nums[r.nums.length - 1] ?? null;
    }

    cleaned.push({
      pos: r.pos,
      team: r.team,
      played,
      won,
      drawn,
      lost,
      pointsFor,
      pointsAgainst,
      points,
    });
  }

  const seen = new Set<string>();
  return cleaned.filter((r) => {
    const k = norm(r.team);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function inferDateFingerprint(rawText: string) {
  const s = rawText || "";
  const m1 = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/i);
  if (m1) return m1[0];
  const m2 = s.match(/\b\d{1,2}\.\d{1,2}\.?\b/);
  if (m2) return m2[0];
  const m3 = s.match(/\b\d{1,2}\/\d{1,2}\b/);
  if (m3) return m3[0];
  return "";
}

function dedupeScrapedRows(rows: ScrapedRow[]) {
  const seen = new Set<string>();
  const out: ScrapedRow[] = [];

  for (const r of rows) {
    const inferredDate = norm(r.dateLabel) || inferDateFingerprint(r.rawText);

    const key = [
      r.sourcePage,
      inferredDate,
      norm(r.home),
      norm(r.away),
      r.hs || "",
      r.as || "",
      r.statusOrTime || "",
      r.roundText || "",
    ].join("||");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

async function scrapeMatchDetailStatus(page: Page, rawUrl: string) {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://www.flashscore.com${rawUrl}`;

  try {
    await gotoWithRetry(page, url, 2);
    await maybeAcceptConsent(page);
    await page.waitForTimeout(900);

    const statusText = await page.evaluate(() => {
      const pick = (selector: string) => {
        const node = document.querySelector(selector);
        return String(node?.textContent ?? "").trim();
      };

      return [
        pick(".detailScore__status"),
        pick(".fixedHeaderDuel__detailStatus"),
        pick(".detailScore__matchInfo"),
      ]
        .filter(Boolean)
        .join(" ");
    });

    return statusText.trim() || null;
  } catch (error) {
    console.log("WARN: detail live status scrape failed:", url, describeError(error));
    return null;
  }
}

function buildExistingIndexes(matches: DbMatchRow[]) {
  const byTeams = new Map<string, DbMatchRow[]>();
  const bySourceKey = new Map<string, DbMatchRow>();

  for (const m of matches) {
    const pairKey =
      m.home_team_id < m.away_team_id
        ? `${m.home_team_id}__${m.away_team_id}`
        : `${m.away_team_id}__${m.home_team_id}`;

    const arr1 = byTeams.get(pairKey) || [];
    arr1.push(m);
    byTeams.set(pairKey, arr1);

    if (m.source_event_key) {
      bySourceKey.set(m.source_event_key, m);
    }
  }

  return { byTeams, bySourceKey };
}

async function saveMatchBySourceKey(payload: Record<string, unknown>) {
  if (DRY_RUN) {
    return "inserted";
  }

  const sourceEventKey = (payload.source_event_key as string | null) ?? null;
  const seasonId = payload.season_id as number;
  const matchDate = payload.match_date as string;
  const kickoffTime = (payload.kickoff_time as string | null) ?? null;
  const homeTeamId = payload.home_team_id as number;
  const awayTeamId = payload.away_team_id as number;

  if (sourceEventKey) {
    const { data: existingBySource, error: findSourceErr } = await ensureSupabase()
      .from("matches")
      .select("id,status")
      .eq("source_event_key", sourceEventKey)
      .limit(1)
      .maybeSingle();

    if (findSourceErr) throw findSourceErr;

    if (existingBySource?.id) {
      if (existingBySource.status === "FT" && payload.status === "NS") {
        return "skipped";
      }

      const { error: updateErr } = await ensureSupabase()
        .from("matches")
        .update(payload)
        .eq("id", existingBySource.id);

      if (updateErr) throw updateErr;
      return "updated";
    }
  }

  let logicalQuery = ensureSupabase()
    .from("matches")
    .select("id,status")
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
    if (existingLogical.status === "FT" && payload.status === "NS") {
      return "skipped";
    }

    const { error: updateErr } = await ensureSupabase()
      .from("matches")
      .update(payload)
      .eq("id", existingLogical.id);

    if (updateErr) throw updateErr;
    return "updated";
  }

  const { error: insertErr } = await ensureSupabase().from("matches").insert(payload);
  if (insertErr) throw insertErr;

  return "inserted";
}

async function upsertStandingsCache(
  seasonId: number,
  teamsMap: Map<string, number>,
  teamNamesNorm: string[],
  rows: ScrapedStandingRow[]
) {
  if (!rows.length) return;
  if (DRY_RUN) return;

  const payloadByTeam = new Map<number, Record<string, unknown>>();

  for (const row of rows) {
    const teamId = await getOrCreateTeamId(row.team, teamsMap, teamNamesNorm);
    if (!teamId) continue;

    payloadByTeam.set(teamId, {
      season_id: seasonId,
      team_id: teamId,
      position: row.pos,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      points_for: row.pointsFor,
      points_against: row.pointsAgainst,
      points: row.points,
      source: "flashscore",
      updated_at: new Date().toISOString(),
    });
  }

  const payload = Array.from(payloadByTeam.values());
  if (!payload.length) return;

  const { error } = await ensureSupabase()
    .from("standings_cache")
    .upsert(payload, { onConflict: "season_id,team_id" });

  if (error) {
    console.log("WARN: standings_cache upsert failed:", error.message);
  } else {
    console.log(`Standings upserted: ${payload.length}`);
  }
}

async function main() {
  const inputs = urlsFromEnv();
  console.log("Inputs:", inputs);
  console.log("Mode:", DRY_RUN ? "DRY_RUN" : "LIVE_DB");
  console.log("Flags:", JSON.stringify({ LIVE_ONLY, MATCHES_ONLY, STANDINGS_ONLY }));

  if (!DRY_RUN) {
    const { error: pingErr } = await ensureSupabase().from("competitions").select("id").limit(1);
    if (pingErr) throw pingErr;
  }

  if (LIVE_ONLY && !DRY_RUN) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data, error } = await ensureSupabase()
      .from("matches")
      .select("id,status,match_date,kickoff_time")
      .gte("match_date", yesterday.toISOString().slice(0, 10))
      .lte("match_date", tomorrow.toISOString().slice(0, 10))
      .neq("status", "FT")
      .limit(40);

    if (error) throw error;
    const candidates = (data || []) as Array<{
      id: number;
      status: MatchStatus | null;
      match_date: string;
      kickoff_time: string | null;
    }>;
    const hasRelevantWindow = candidates.some((row) =>
      isPotentiallyLiveWindow(row.match_date, row.kickoff_time, row.status ?? "NS")
    );

    if (!hasRelevantWindow) {
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
  const detailPage = LIVE_ONLY
    ? await browser.newPage({
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      })
    : null;

  const blockHeavyAssets = (route: Route) => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") return route.abort();
    return route.continue();
  };

  await page.route("**/*", blockHeavyAssets);
  if (detailPage) {
    await detailPage.route("**/*", blockHeavyAssets);
  }

  let totalUpdates = 0;
  let totalInsertedOrUpserted = 0;

  try {
    for (const item of inputs) {
      const compSlug = item.compSlug?.trim() || competitionSlugFromUrl(item.url);

      if (!compSlug) {
        console.log("Skip (unknown comp url):", item.url);
        continue;
      }

      let seasonCandidates: SeasonRow[] = [];

      if (!DRY_RUN) {
        try {
          seasonCandidates = await getSeasonCandidatesByCompSlug(compSlug);
        } catch (error) {
          console.log(`Skip ${compSlug}: ${describeError(error)}`);
          continue;
        }
      }

      const variants = buildFlashVariants(item.url);
      const scrapedAll: ScrapedRow[] = [];

      for (const url of variants.resultsAndFixtures) {
        try {
          const sourcePage: "results" | "fixtures" | "live" = /\/results$/i.test(url)
            ? "results"
            : /\/live$/i.test(url)
              ? "live"
              : "fixtures";

          console.log("Open:", url);
          await gotoWithRetry(page, url, 3);
          await maybeAcceptConsent(page);

          try {
            await page.waitForSelector(
              '[id^="g_"], .event__match, .event__row, [data-event-id], .event',
              { timeout: 20000 }
            );
          } catch {
            console.log("WARN: selector not found quickly:", url);
          }

          await clickShowMore(page);
          await page.waitForTimeout(1200);

          const rows = dedupeScrapedRows(await scrapePage(page, sourcePage));
          console.log(`Scraped from ${url}:`, rows.length);
          scrapedAll.push(...rows);
        } catch (e) {
          console.log("WARN: failed scraping url:", url);
          console.log(e);
        }
      }

      const scraped = dedupeScrapedRows(scrapedAll);
      console.log("Scraped rows total (deduped):", scraped.length);

      const seasonMeta = DRY_RUN
        ? { seasonId: 0, seasonName: `dry-run-${new Date().getUTCFullYear()}` }
        : pickSeasonForScrapedRows(seasonCandidates, scraped);
      const existingMatches = DRY_RUN ? [] : await getMatchesBySeason(seasonMeta.seasonId);
      const { byTeams, bySourceKey } = buildExistingIndexes(existingMatches);

      console.log(`\n== ${compSlug} (${seasonMeta.seasonName}) ==`);
      console.log(`Existing matches in season: ${existingMatches.length}`);

      let updatedHere = 0;
      let insertedHere = 0;
      let skippedWithoutDate = 0;
      let resetFutureScores = 0;

      const touchedIds = new Set<number>();
      const unresolvedTeams = new Set<string>();
      const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      for (const row of STANDINGS_ONLY ? [] : scraped) {
        const homeId = await getOrCreateTeamId(row.home, teamsMap, teamNamesNorm);
        const awayId = await getOrCreateTeamId(row.away, teamsMap, teamNamesNorm);

        if (!homeId || !awayId) {
          console.log("UNRESOLVED TEAM:", row.home, "vs", row.away);
          unresolvedTeams.add(`${row.home} vs ${row.away}`);
          continue;
        }

        const hs = parseScore(row.hs);
        const as = parseScore(row.as);
        let parsed = detectStatusAndMinute(row.statusOrTime, hs, as, row.sourcePage);
        const round = parseRound(row.roundText || row.rawText);

        const inferredDate =
          inferMatchDateFromRawText(row.dateLabel, seasonMeta.seasonName) ||
          inferMatchDateFromRawText(row.rawText, seasonMeta.seasonName);

        if (!inferredDate) {
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

        let sourceKey: string | null = null;
        let target: DbMatchRow | null = null;
        const kickoffTime = parseKickoffTime(row.statusOrTime || row.rawText);
        const matchDate = inferredDate;
        let effectiveParsed =
          parsed.status !== "NS" && matchDate > tomorrowIso
            ? ({ status: "NS", minute: null } as const)
            : parsed;

        if (effectiveParsed !== parsed) {
          resetFutureScores++;
        }

        if (LIVE_ONLY && effectiveParsed.status === "LIVE" && effectiveParsed.minute == null && row.detailUrl && detailPage) {
          const detailStatus = await scrapeMatchDetailStatus(detailPage, row.detailUrl);
          if (detailStatus) {
            const detailParsed = detectStatusAndMinute(detailStatus, hs, as, "live");
            if (detailParsed.status === "LIVE" || detailParsed.status === "FT") {
              parsed = detailParsed;
              effectiveParsed =
                matchDate > tomorrowIso
                  ? ({ status: "NS", minute: null } as const)
                  : detailParsed;
            }
          }
        }

        if (LIVE_ONLY && effectiveParsed.status === "NS") {
          continue;
        }

        sourceKey = buildSourceEventKey({
          compSlug,
          seasonName: seasonMeta.seasonName,
          matchDate,
          kickoffTime,
          homeName: row.home,
          awayName: row.away,
        });

        if (bySourceKey.has(sourceKey)) {
          target = bySourceKey.get(sourceKey)!;
        }

        if (!target) {
          const pairKey = homeId < awayId ? `${homeId}__${awayId}` : `${awayId}__${homeId}`;
          const possible = (byTeams.get(pairKey) || []).filter((candidate) => {
            if (candidate.match_date !== matchDate) return false;
            if (!kickoffTime || !candidate.kickoff_time) return true;
            return candidate.kickoff_time.slice(0, 5) === kickoffTime.slice(0, 5);
          });

          if (possible.length > 0) {
            target = pickBestCandidate(possible, matchDate, kickoffTime);
          }
        }

        if (target?.status === "FT" && effectiveParsed.status === "NS") {
          continue;
        }

        const payload: Record<string, unknown> = {
          season_id: seasonMeta.seasonId,
          match_date: matchDate,
          kickoff_time: kickoffTime,
          status: effectiveParsed.status,
          minute: effectiveParsed.minute,
          home_team_id: homeId,
          away_team_id: awayId,
          round: round ?? target?.round ?? null,
          source: "flashscore",
          source_event_key: sourceKey,
          source_url: normalizeFlashUrl(item.url),
          updated_at: new Date().toISOString(),
        };

        if (effectiveParsed.status === "NS") {
          payload.home_score = null;
          payload.away_score = null;
        } else {
          payload.home_score = hs;
          payload.away_score = as;
        }

        if (target?.id && !touchedIds.has(target.id)) {
          const patch: Record<string, unknown> = { ...payload };

          if (target.status === "FT" && patch.status === "NS") {
            continue;
          }

          const { error } = await ensureSupabase()
            .from("matches")
            .update(patch)
            .eq("id", target.id);

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
            } else if (action === "inserted") {
              insertedHere++;
              totalInsertedOrUpserted++;
            }
          } catch (e: unknown) {
            console.log("WARN: save by source_event_key failed:", e instanceof Error ? e.message : e);
          }
        }
      }

      if (!MATCHES_ONLY && !LIVE_ONLY) {
        try {
        console.log("Open standings:", variants.standings);
        await gotoWithRetry(page, variants.standings, 3);
        await maybeAcceptConsent(page);
        await page.waitForTimeout(1500);

        const standings = await scrapeStandingsPage(page);
        console.log(`Standings scraped: ${standings.length}`);

        if (standings.length > 0) {
          await upsertStandingsCache(seasonMeta.seasonId, teamsMap, teamNamesNorm, standings);
        }

        if (DRY_RUN) {
          writeDryRunDump(compSlug, {
            competition: compSlug,
            seasonName: seasonMeta.seasonName,
            sourceUrl: normalizeFlashUrl(item.url),
            scrapedMatches: scraped,
            standings,
          });
        }
        } catch (e: unknown) {
          console.log("WARN: standings scrape failed:", e instanceof Error ? e.message : e);
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

      if (resetFutureScores > 0) {
        console.log(`Future score resets in ${compSlug}: ${resetFutureScores}`);
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
