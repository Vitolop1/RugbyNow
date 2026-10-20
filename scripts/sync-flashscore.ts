import { applyProD2TeamAliases, canonicalProD2TeamName } from "../lib/proD2";
import { competitionSlugFromFlashscoreUrl } from "../lib/flashscoreCompetition";
import {detectStatusAndMinute} from "../lib/sourceMatchStatus";
import {validateResolvedStandingsTeamIds,validateSourceStandings} from "../lib/sourceStandings";
import {readAllRows} from "../lib/readAllRows";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, Page, Route } from "playwright";
import { inferMatchDateFromRawText, inferMatchDateFromScrapedRow, seasonYearBounds, selectSeasonForScrapedRow } from "../lib/scrapedMatchDate";
import { resolveExactSourceTeam } from "../lib/sourceTeamIdentity";

type MatchStatus = "NS" | "LIVE" | "HT" | "FT" | "CANC";

function isNonPlayedStatus(status: MatchStatus) {
  return status === "NS" || status === "CANC";
}

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
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  round: number | null;
  source_event_key: string | null;
};

type ScrapedRow = {
  home: string | null;
  away: string | null;
  hs: string;
  as: string;
  statusOrTime: string;
  roundText: string;
  sectionText: string;
  rawText: string;
  dateLabel: string;
  detailUrl: string | null;
  sourcePage: "results" | "fixtures" | "live";
  sourceSeasonName?: string;
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
const CLEANUP_PLACEHOLDER_DUPLICATES = process.env.CLEANUP_PLACEHOLDER_DUPLICATES === "1";

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
  const dir = path.resolve(process.cwd(), process.env.DRY_RUN_REPORT_DIR || "logs");
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

type KnockoutPhaseKey = "round32" | "round16" | "quarterfinal" | "semifinal" | "final";

function parseKnockoutPhaseKey(raw: string): KnockoutPhaseKey | null {
  const s = (raw || "").toLowerCase();
  if (!s) return null;
  if (/semi[\s-]*final/.test(s)) return "semifinal";
  if (/quarter[\s-]*final/.test(s)) return "quarterfinal";
  if (/\b(round of 16|last 16|round 16)\b/.test(s)) return "round16";
  if (/\b(round of 32|last 32|round 32)\b/.test(s)) return "round32";
  if (/(^|[\s|/-])final(s)?([\s|/-]|$)/.test(s)) return "final";
  return null;
}

function normalizeKnockoutStageLabel(raw: string) {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (/5(?:th)?\s*[-–]\s*8(?:th)?/i.test(s)) return "5th-8th places";
  if (/9(?:th)?\s*[-–]\s*12(?:th)?/i.test(s)) return "9th-12th places";
  if (/13(?:th)?\s*[-–]\s*16(?:th)?/i.test(s)) return "13th-16th places";
  if (/play\s*offs?/i.test(s)) return "Play Offs";
  if (/\bmain\b/i.test(s)) return "Main";
  if (/\bcup\b/i.test(s)) return "Cup";
  if (/\bplate\b/i.test(s)) return "Plate";
  if (/\bbowl\b/i.test(s)) return "Bowl";
  if (/\bshield\b/i.test(s)) return "Shield";
  if (/\bbronze\b/i.test(s)) return "Bronze";
  return null;
}

function extractKnockoutMeta(row: Pick<ScrapedRow, "roundText" | "sectionText" | "rawText">) {
  const combined = [row.sectionText, row.roundText, row.rawText].filter(Boolean).join(" | ");
  const phaseKey = parseKnockoutPhaseKey(combined);
  if (!phaseKey) return null;

  const stageLabel = normalizeKnockoutStageLabel(combined);
  return { phaseKey, stageLabel };
}

function appendKnockoutMetaToSourceUrl(
  baseUrl: string,
  meta: { phaseKey: KnockoutPhaseKey; stageLabel?: string | null } | null
) {
  if (!meta) return baseUrl;

  const url = new URL(baseUrl);
  const params = new URLSearchParams();
  params.set("rn_phase", meta.phaseKey);
  if (meta.stageLabel) params.set("rn_stage", meta.stageLabel);
  url.hash = params.toString();
  return url.toString();
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
  const value = new Date(`${matchDate}T${normalized}Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isPotentiallyLiveWindow(matchDate: string, kickoffTime?: string | null, status?: MatchStatus | null) {
  if (status === "LIVE" || status === "HT") return true;

  const kickoff = parseMatchDateTime(matchDate, kickoffTime);
  if (!kickoff) return false;

  const diffMinutes = Math.floor((Date.now() - kickoff.getTime()) / 60000);
  return diffMinutes >= -15 && diffMinutes <= 130;
}

const competitionSlugFromUrl = competitionSlugFromFlashscoreUrl;

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

async function ensureSourceSeasons(compSlug: string, seasons: SeasonRow[], sourceNames: string[]) {
  const names = [...new Set(sourceNames)];
  const result = [...seasons];
  for (const name of names) {
    const bounds = seasonYearBounds(name);
    if (!bounds || result.some((season) => {
      const existing = seasonYearBounds(season.name);
      return existing?.startYear === bounds.startYear && existing.endYear === bounds.endYear;
    })) continue;
    if (DRY_RUN) {
      result.push({ id: -(result.length + 1), name });
      continue;
    }
    const { data: competition, error: compError } = await ensureSupabase().from("competitions").select("id").eq("slug", compSlug).single();
    if (compError) throw compError;
    const { data: existing, error: lookupError } = await ensureSupabase().from("seasons").select("id,name").eq("competition_id", competition.id).eq("name", name).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) result.push(existing as SeasonRow);
    else {
      const { data: created, error } = await ensureSupabase().from("seasons").insert({ competition_id: competition.id, name }).select("id,name").single();
      if (error) throw error;
      result.push(created as SeasonRow);
    }
  }
  return result;
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

  applyProD2TeamAliases(map);
  return { teamsMap: map, teamNamesNorm: names };
}

async function getOrCreateTeamId(rawName: string, teamsMap: Map<string, number>, teamNamesNorm: string[]) {
  const existing = resolveExactSourceTeam(rawName, teamsMap) ?? resolveExactSourceTeam(canonicalProD2TeamName(rawName), teamsMap);
  if (existing) return existing;

  const cleanName = canonicalProD2TeamName(rawName);
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
  homeName?: string | null;
  awayName?: string | null;
  detailUrl?: string | null;
  phaseKey?: KnockoutPhaseKey | null;
  stageLabel?: string | null;
}) {
  const flashscoreEventId = extractFlashscoreEventId(params.detailUrl ?? null);
  if (flashscoreEventId) {
    return slugify(`${params.compSlug}|flashscore|${flashscoreEventId}`);
  }

  return slugify(
    [
      params.compSlug,
      params.seasonName,
      params.matchDate,
      params.kickoffTime || "",
      params.homeName || "tbd-home",
      params.awayName || "tbd-away",
      params.phaseKey || "",
      params.stageLabel || "",
    ].join("|")
  );
}

function extractFlashscoreEventId(detailUrl: string | null) {
  if (!detailUrl) return null;

  try {
    const url = new URL(detailUrl, "https://www.flashscore.com");
    return url.searchParams.get("mid") || null;
  } catch {
    const match = detailUrl.match(/[?&]mid=([^&#]+)/i);
    return match?.[1] ?? null;
  }
}

function isPlaceholderKickoffTime(kickoffTime?: string | null) {
  return !kickoffTime || kickoffTime === "00:00:00" || kickoffTime === "00:00";
}

function minutesBetweenMatchSlots(
  leftDate: string,
  leftKickoff: string | null,
  rightDate: string,
  rightKickoff: string | null
) {
  const left = parseMatchDateTime(leftDate, leftKickoff);
  const right = parseMatchDateTime(rightDate, rightKickoff);
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.abs(left.getTime() - right.getTime()) / 60000;
}

function findNearbyDirectionalCandidate(
  possible: DbMatchRow[],
  homeTeamId: number,
  awayTeamId: number,
  matchDate: string,
  kickoffTime: string | null
) {
  const sameDirection = possible.filter(
    (candidate) => candidate.home_team_id === homeTeamId && candidate.away_team_id === awayTeamId
  );

  if (!sameDirection.length) return null;

  const sameDate = sameDirection.filter((candidate) => candidate.match_date === matchDate);
  if (sameDate.length) {
    return pickBestCandidate(sameDate, matchDate, kickoffTime);
  }

  const nearby = sameDirection.filter((candidate) => {
    if (candidate.status === "FT") return false;
    if (dateDistanceDays(candidate.match_date, matchDate) > 1) return false;

    const minutesApart = minutesBetweenMatchSlots(
      candidate.match_date,
      candidate.kickoff_time,
      matchDate,
      kickoffTime
    );

    return (
      minutesApart <= 360 ||
      isPlaceholderKickoffTime(candidate.kickoff_time) ||
      isPlaceholderKickoffTime(kickoffTime)
    );
  });

  if (!nearby.length) return null;
  return pickBestCandidate(nearby, matchDate, kickoffTime);
}

function findPotentiallyLiveDirectionalCandidate(possible: DbMatchRow[], homeTeamId: number, awayTeamId: number) {
  const sameDirection = possible.filter(
    (candidate) =>
      candidate.home_team_id === homeTeamId &&
      candidate.away_team_id === awayTeamId &&
      candidate.status !== "FT" &&
      isPotentiallyLiveWindow(candidate.match_date, candidate.kickoff_time, candidate.status)
  );

  if (!sameDirection.length) return null;
  return pickBestCandidate(sameDirection);
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

async function maybeAcceptConsent(page: Page) {
  const selectors = [
    'button:has-text("Reject All")',
    'button:has-text("Rechazar todo")',
    '#onetrust-reject-all-handler',
    'button:has-text("I Accept")',
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
  const rowLikeSelector = '[id^="g_"], .event__match, .event__row, [data-event-id], .event';
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

  const isUsefulContext = (txt) => {
    const s = (txt || "").replace(/\\s+/g, " ").trim();
    if (!s || looksLikeDate(s) || s.length > 90) return false;
    if (/^(world:?|summary|results|fixtures|standings|archive|today's matches|scheduled)$/i.test(s)) return false;
    if (/^(advertisement|scores|news|login)$/i.test(s)) return false;
    return true;
  };

  const findSectionContext = (row) => {
    const labels = [];
    let node = row;

    while (node) {
      let prev = node.previousElementSibling;
      let seenAtLevel = 0;

      while (prev && seenAtLevel < 8) {
        if (prev.matches?.(rowLikeSelector) || prev.querySelector?.(rowLikeSelector)) {
          break;
        }
        const txt = pickText(prev);
        if (isUsefulContext(txt) && !labels.includes(txt)) {
          labels.unshift(txt);
        }
        prev = prev.previousElementSibling;
        seenAtLevel += 1;
      }

      node = node.parentElement;
    }

    return labels.join(" | ");
  };

  const out = [];
  const seasonText = pickText(document.querySelector(".heading__info"));
  const sourceSeasonName = seasonText.match(/\\b(?:19|20)\\d{2}(?:\\s*[/-]\\s*(?:(?:19|20)\\d{2}|\\d{2}))?\\b/)?.[0] || "";
  const rows = Array.from(document.querySelectorAll(rowLikeSelector));

  for (const r of rows) {
    const nestedRows = r.querySelectorAll(rowLikeSelector).length;
    if (nestedRows > 1) continue;

    const home =
      pickText(r.querySelector(".event__participant--home")) ||
      pickText(r.querySelector(".event__homeParticipant")) ||
      pickText((r.querySelectorAll(".event__participant")[0]) || null);

    const away =
      pickText(r.querySelector(".event__participant--away")) ||
      pickText(r.querySelector(".event__awayParticipant")) ||
      pickText((r.querySelectorAll(".event__participant")[1]) || null);

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
    const sectionText = findSectionContext(r);
    const knockoutLike = /(semi[\s-]*final|quarter[\s-]*final|(^|[\s|/-])final(s)?([\s|/-]|$)|play\s*offs?|5(?:th)?\s*[-–]\s*8(?:th)?|9(?:th)?\s*[-–]\s*12(?:th)?|13(?:th)?\s*[-–]\s*16(?:th)?|bronze|cup|plate|bowl|shield)/i.test(
      [sectionText, roundText, rawText].join(" ")
    );
    const hasScheduleHint =
      /\b\d{1,2}:\d{2}\b/i.test([statusOrTime, rawText].join(" ")) ||
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/i.test(rawText) ||
      /\b\d{1,2}\.\d{1,2}\.?\b/.test(rawText);

    if ((!home || !away) && !(knockoutLike && hasScheduleHint)) continue;

    const detailUrl =
      r.querySelector(".eventRowLink")?.getAttribute("href") ||
      r.querySelector("a[href*='/match/']")?.getAttribute("href") ||
      null;

    out.push({
      home: home || null,
      away: away || null,
      hs,
      as,
      statusOrTime,
      roundText,
      sectionText,
      rawText,
      dateLabel,
      detailUrl,
      sourceSeasonName,
    });
  }

  return out;
})()
`;

  const rows = (await page.evaluate(js)) as Omit<ScrapedRow, "sourcePage">[];
  const enriched = rows.map((r) => ({ ...r, sourcePage }));

  for (let i = 1; i < enriched.length; i += 1) {
    const current = enriched[i];
    const previous = enriched[i - 1];
    const currentMeta = extractKnockoutMeta(current);
    const previousMeta = extractKnockoutMeta(previous);

    if (currentMeta || !previousMeta) continue;

    const currentDate =
      inferMatchDateFromRawText(current.statusOrTime, "2026") ||
      inferMatchDateFromRawText(current.rawText, "2026") ||
      inferMatchDateFromRawText(current.dateLabel, "2026") ||
      inferDateFingerprint(current.rawText);
    const previousDate =
      inferMatchDateFromRawText(previous.statusOrTime, "2026") ||
      inferMatchDateFromRawText(previous.rawText, "2026") ||
      inferMatchDateFromRawText(previous.dateLabel, "2026") ||
      inferDateFingerprint(previous.rawText);
    const currentKickoff = parseKickoffTime(current.statusOrTime || current.rawText);
    const previousKickoff = parseKickoffTime(previous.statusOrTime || previous.rawText);

    if (currentDate !== previousDate || !currentKickoff || !previousKickoff) continue;

    const minutesApart = minutesBetweenMatchSlots("2026-01-01", currentKickoff, "2026-01-01", previousKickoff);
    if (minutesApart > 40) continue;

    current.sectionText = [current.sectionText, previous.sectionText || previous.roundText].filter(Boolean).join(" | ");
    if (!current.roundText && previous.roundText) {
      current.roundText = previous.roundText;
    }
  }

  return enriched;
}

async function scrapeStandingsPage(page: Page) {
  function tryBuildStandingWindow(nums: number[], start: number) {
    if (start < 0 || start + 6 >= nums.length) return null;

    const played = nums[start] ?? null;
    const won = nums[start + 1] ?? null;
    const drawn = nums[start + 2] ?? null;
    const lost = nums[start + 3] ?? null;
    const pointsFor = nums[start + 4] ?? null;
    const pointsAgainst = nums[start + 5] ?? null;
    const points = nums[nums.length - 1] ?? null;

    if (
      played == null ||
      won == null ||
      drawn == null ||
      lost == null ||
      pointsFor == null ||
      pointsAgainst == null ||
      points == null
    ) {
      return null;
    }

    if (played !== won + drawn + lost) return null;

    return {
      played,
      won,
      drawn,
      lost,
      pointsFor,
      pointsAgainst,
      points,
    };
  }

  function extractStandingStats(raw: string, nums: number[]) {
    const compact = raw.replace(/\s+/g, " ").trim();
    const structured =
      compact.match(/^\s*\d+\.\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+):(\d+)\s+(-?\d+)\b/) ||
      compact.match(/^\s*(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+):(\d+)\s+(-?\d+)\b/);

    if (structured) {
      const parsed = {
        played: Number.parseInt(structured[2], 10),
        won: Number.parseInt(structured[3], 10),
        drawn: Number.parseInt(structured[4], 10),
        lost: Number.parseInt(structured[5], 10),
        pointsFor: Number.parseInt(structured[6], 10),
        pointsAgainst: Number.parseInt(structured[7], 10),
        points: Number.parseInt(structured[8], 10),
      };

      if (parsed.played === parsed.won + parsed.drawn + parsed.lost) {
        return parsed;
      }
    }

    for (let start = 0; start <= nums.length - 7; start += 1) {
      const candidate = tryBuildStandingWindow(nums, start);
      if (candidate) return candidate;
    }

    if (nums.length >= 7) {
      return tryBuildStandingWindow(nums, 0);
    }

    return null;
  }

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

    const parsed = extractStandingStats(r.raw, r.nums);
    if (parsed) {
      played = parsed.played;
      won = parsed.won;
      drawn = parsed.drawn;
      lost = parsed.lost;
      pointsFor = parsed.pointsFor;
      pointsAgainst = parsed.pointsAgainst;
      points = parsed.points;
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
    const inferredDate = norm(r.dateLabel) || inferDateFingerprint(r.statusOrTime) || inferDateFingerprint(r.rawText);

    const key = [
      r.sourcePage,
      inferredDate,
      norm(r.home || ""),
      norm(r.away || ""),
      r.hs || "",
      r.as || "",
      r.statusOrTime || "",
      r.roundText || "",
      r.sectionText || "",
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
    await page.waitForTimeout(450);

    const selectors = [
      ".detailScore__status",
      ".fixedHeaderDuel__detailStatus",
      ".detailScore__matchInfo",
    ];
    const parts: string[] = [];

    for (const selector of selectors) {
      const text = (await page.locator(selector).first().textContent().catch(() => null))?.trim();
      if (text) {
        parts.push(text);
      }
    }

    const statusText = parts.join(" ");

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
    if (m.home_team_id != null && m.away_team_id != null) {
      const pairKey =
        m.home_team_id < m.away_team_id
          ? `${m.home_team_id}__${m.away_team_id}`
          : `${m.away_team_id}__${m.home_team_id}`;

      const arr1 = byTeams.get(pairKey) || [];
      arr1.push(m);
      byTeams.set(pairKey, arr1);
    }

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
  const homeTeamId = (payload.home_team_id as number | null) ?? null;
  const awayTeamId = (payload.away_team_id as number | null) ?? null;

  if (sourceEventKey) {
    const { data: existingBySource, error: findSourceErr } = await ensureSupabase()
      .from("matches")
      .select("id,status")
      .eq("source_event_key", sourceEventKey)
      .limit(1)
      .maybeSingle();

    if (findSourceErr) throw findSourceErr;

    if (existingBySource?.id) {
      if (existingBySource.status === "FT" && isNonPlayedStatus(payload.status as MatchStatus)) {
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
    .limit(1);

  logicalQuery =
    homeTeamId == null ? logicalQuery.is("home_team_id", null) : logicalQuery.eq("home_team_id", homeTeamId);
  logicalQuery =
    awayTeamId == null ? logicalQuery.is("away_team_id", null) : logicalQuery.eq("away_team_id", awayTeamId);

  if (kickoffTime === null) {
    logicalQuery = logicalQuery.is("kickoff_time", null);
  } else {
    logicalQuery = logicalQuery.eq("kickoff_time", kickoffTime);
  }

  const { data: existingLogical, error: findLogicalErr } = await logicalQuery.maybeSingle();

  if (findLogicalErr) throw findLogicalErr;

  if (existingLogical?.id) {
    if (existingLogical.status === "FT" && isNonPlayedStatus(payload.status as MatchStatus)) {
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

async function cleanupPlaceholderMidnightDuplicates(seasonId: number) {
  if (DRY_RUN) return 0;

  const { data, error } = await ensureSupabase()
    .from("matches")
    .select("id,season_id,match_date,kickoff_time,status,minute,home_team_id,away_team_id,home_score,away_score,round,source_event_key")
    .eq("season_id", seasonId)
    .order("match_date", { ascending: true })
    .order("kickoff_time", { ascending: true });

  if (error) throw error;

  const rows = (data || []) as DbMatchRow[];
  const byDirectionalPair = new Map<string, DbMatchRow[]>();

  for (const row of rows) {
    if (row.home_team_id == null || row.away_team_id == null) continue;
    const key = `${row.home_team_id}__${row.away_team_id}`;
    const bucket = byDirectionalPair.get(key) || [];
    bucket.push(row);
    byDirectionalPair.set(key, bucket);
  }

  const idsToDelete = new Set<number>();

  for (const pairRows of byDirectionalPair.values()) {
    for (const row of pairRows) {
      if (!isPlaceholderKickoffTime(row.kickoff_time)) continue;

      const replacement = pairRows.find((candidate) => {
        if (candidate.id === row.id) return false;
        if (isPlaceholderKickoffTime(candidate.kickoff_time)) return false;
        if (dateDistanceDays(candidate.match_date, row.match_date) > 1) return false;
        if (row.status === "FT" || candidate.status === "FT") {
          if (row.status !== candidate.status) return false;
          if (row.home_score !== candidate.home_score || row.away_score !== candidate.away_score) return false;
        }

        return (
          minutesBetweenMatchSlots(candidate.match_date, candidate.kickoff_time, row.match_date, row.kickoff_time) <=
          360
        );
      });

      if (replacement) {
        idsToDelete.add(row.id);
      }
    }
  }

  const ids = Array.from(idsToDelete);
  if (!ids.length) return 0;

  const { error: deleteError } = await ensureSupabase().from("matches").delete().in("id", ids);
  if (deleteError) throw deleteError;

  return ids.length;
}

async function upsertStandingsCache(
  seasonId: number,
  teamsMap: Map<string, number>,
  teamNamesNorm: string[],
  rows: ScrapedStandingRow[],
  compSlug: string
) {
  validateSourceStandings(rows, compSlug === "fr-pro-d2" ? 16 : undefined);
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
  if (compSlug === "fr-pro-d2") {
    validateResolvedStandingsTeamIds(payload.map(row => row.team_id as number), 16);
  }
  if (!payload.length) return;

  const { error } = await ensureSupabase()
    .from("standings_cache")
    .upsert(payload, { onConflict: "season_id,team_id" });

  if (error) {
    throw new Error(`Standings write failed: ${error.message}`);
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

    const candidates=await readAllRows<{id:number;status:MatchStatus|null;match_date:string;kickoff_time:string|null}>((offset,size)=>ensureSupabase().from("matches").select("id,status,match_date,kickoff_time").gte("match_date",yesterday.toISOString().slice(0,10)).lte("match_date",tomorrow.toISOString().slice(0,10)).neq("status","FT").order("id").range(offset,offset+size-1));
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
    timezoneId: "UTC",
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });
  const detailPage = LIVE_ONLY
    ? await browser.newPage({
        timezoneId: "UTC",
        locale: "en-US",
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
  let totalFailures = 0;

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
          totalFailures++;
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

          if (sourcePage === "live") {
            await page.waitForTimeout(350);
          } else {
            await clickShowMore(page);
            await page.waitForTimeout(1200);
          }

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
      if (!scraped.length && !STANDINGS_ONLY && !LIVE_ONLY) {
        console.error(`No results or fixtures could be read for ${compSlug}.`);
        totalFailures++;
        continue;
      }

      let standingsSeasonName = "";
      if (STANDINGS_ONLY) {
        await gotoWithRetry(page, variants.standings, 3);
        await maybeAcceptConsent(page);
        const heading = await page.locator(".heading__info").first().textContent({ timeout: 10000 });
        standingsSeasonName = heading?.match(/\b(?:19|20)\d{2}(?:\s*[/-]\s*(?:(?:19|20)\d{2}|\d{2}))?\b/)?.[0] ?? "";
        if (!standingsSeasonName) throw new Error(`Cannot establish standings edition for ${compSlug}; no standings were written.`);
      }
      const sourceSeasonNames = scraped.flatMap((row) => {
        if (row.sourceSeasonName) return [row.sourceSeasonName];
        const fullDate = inferMatchDateFromScrapedRow(row, "Current");
        return fullDate ? [fullDate.slice(0, 4)] : [];
      });
      seasonCandidates = await ensureSourceSeasons(compSlug, seasonCandidates, [...sourceSeasonNames, standingsSeasonName].filter(Boolean));
      const seasonGroups = new Map<number, { season: SeasonRow; rows: ScrapedRow[] }>();
      let skippedAmbiguousSeason = 0;
      for (const row of scraped) {
        const season = selectSeasonForScrapedRow(seasonCandidates, row);
        if (!season) {
          skippedAmbiguousSeason++;
          continue;
        }
        const group = seasonGroups.get(season.id) ?? { season, rows: [] };
        group.rows.push(row);
        seasonGroups.set(season.id, group);
      }
      if (STANDINGS_ONLY) {
        const season = selectSeasonForScrapedRow(seasonCandidates, { sourceSeasonName: standingsSeasonName, statusOrTime: "", rawText: "", dateLabel: "", sectionText: "" });
        if (!season) throw new Error(`No matching standings season for ${compSlug}`);
        seasonGroups.set(season.id, { season, rows: [] });
      }
      if (skippedAmbiguousSeason) console.warn(`Skipped ${skippedAmbiguousSeason} rows in ${compSlug}: edition could not be established safely.`);
      if (scraped.length && !seasonGroups.size) {
        console.error(`No unambiguous season for ${compSlug}; no matches were written.`);
        totalFailures++;
        continue;
      }
      const groups = [...seasonGroups.values()].sort((a, b) => seasonSortKey(b.season.name) - seasonSortKey(a.season.name));

      for (const [groupIndex, group] of groups.entries()) {
        const seasonMeta = { seasonId: group.season.id, seasonName: group.season.name };
        const existingMatches = DRY_RUN ? [] : await getMatchesBySeason(seasonMeta.seasonId);

        if (DRY_RUN) writeDryRunDump(`${compSlug}-${slugify(seasonMeta.seasonName)}`, {
          competition: compSlug,
          seasonName: seasonMeta.seasonName,
          matches: group.rows.map((row) => ({
            home: row.home, away: row.away, sourcePage: row.sourcePage,
            sourceSeasonName: row.sourceSeasonName,
            matchDate: inferMatchDateFromScrapedRow(row, seasonMeta.seasonName),
            statusOrTime: row.statusOrTime,
            kickoffTime: parseKickoffTime(row.statusOrTime || row.rawText),
            homeScore: parseScore(row.hs), awayScore: parseScore(row.as),
            detailUrl: row.detailUrl,
          })),
        });

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

        for (const row of STANDINGS_ONLY ? [] : group.rows) {
          const homeId = row.home ? await getOrCreateTeamId(row.home, teamsMap, teamNamesNorm) : null;
          const awayId = row.away ? await getOrCreateTeamId(row.away, teamsMap, teamNamesNorm) : null;

          if ((row.home && !homeId) || (row.away && !awayId)) {
            console.log("UNRESOLVED TEAM:", row.home || "TBD", "vs", row.away || "TBD");
            unresolvedTeams.add(`${row.home || "TBD"} vs ${row.away || "TBD"}`);
            continue;
          }

          const hs = parseScore(row.hs);
          const as = parseScore(row.as);
          let parsed = detectStatusAndMinute(row.statusOrTime, hs, as, row.sourcePage);
          const round = parseRound(row.roundText || row.rawText);
          const knockoutMeta = extractKnockoutMeta(row);
          let target: DbMatchRow | null = null;
          let sourceKey: string | null = null;
          let kickoffTime = parseKickoffTime(row.statusOrTime || row.rawText);

          const inferredDate = inferMatchDateFromScrapedRow(row, seasonMeta.seasonName);
          let matchDate = inferredDate;

          sourceKey = buildSourceEventKey({
            compSlug,
            seasonName: seasonMeta.seasonName,
            matchDate: matchDate || "",
            kickoffTime,
            homeName: row.home,
            awayName: row.away,
            detailUrl: row.detailUrl,
            phaseKey: knockoutMeta?.phaseKey ?? null,
            stageLabel: knockoutMeta?.stageLabel ?? null,
          });

          if (sourceKey && bySourceKey.has(sourceKey)) {
            target = bySourceKey.get(sourceKey)!;
          }

          if (!matchDate && LIVE_ONLY) {
            if (homeId != null && awayId != null) {
              const pairKey = homeId < awayId ? `${homeId}__${awayId}` : `${awayId}__${homeId}`;
              target = target || findPotentiallyLiveDirectionalCandidate(byTeams.get(pairKey) || [], homeId, awayId);
            }

            if (target) {
              matchDate = target.match_date;
              kickoffTime = kickoffTime || target.kickoff_time;
            }
          }

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
          let effectiveParsed =
            !isNonPlayedStatus(parsed.status) && matchDate > tomorrowIso
              ? ({ status: "NS", minute: null } as const)
              : parsed;

          if (effectiveParsed !== parsed) {
            resetFutureScores++;
          }

          if (LIVE_ONLY && (effectiveParsed.status === "LIVE" || effectiveParsed.status === "HT") && effectiveParsed.minute == null && row.detailUrl && detailPage) {
            const detailStatus = await scrapeMatchDetailStatus(detailPage, row.detailUrl);
            if (detailStatus) {
              const detailParsed = detectStatusAndMinute(detailStatus, hs, as, "live");
              if (detailParsed.status === "LIVE" || detailParsed.status === "HT" || detailParsed.status === "FT") {
                parsed = detailParsed;
                effectiveParsed =
                  matchDate > tomorrowIso
                    ? ({ status: "NS", minute: null } as const)
                    : detailParsed;
              }
            }
          }

          if (LIVE_ONLY && isNonPlayedStatus(effectiveParsed.status)) {
            continue;
          }

          if (bySourceKey.has(sourceKey)) {
            target = bySourceKey.get(sourceKey)!;
          }

          if (!target) {
            if (homeId != null && awayId != null) {
              const pairKey = homeId < awayId ? `${homeId}__${awayId}` : `${awayId}__${homeId}`;
              const possible = (byTeams.get(pairKey) || []).filter((candidate) => {
                if (candidate.home_team_id !== homeId || candidate.away_team_id !== awayId) return false;
                if (candidate.match_date !== matchDate) return false;
                if (!kickoffTime || !candidate.kickoff_time) return true;
                return candidate.kickoff_time.slice(0, 5) === kickoffTime.slice(0, 5);
              });

              if (possible.length > 0) {
                target = pickBestCandidate(possible, matchDate, kickoffTime);
              }
            }
          }

          if (!target) {
            if (homeId != null && awayId != null) {
              const pairKey = homeId < awayId ? `${homeId}__${awayId}` : `${awayId}__${homeId}`;
              target = findNearbyDirectionalCandidate(byTeams.get(pairKey) || [], homeId, awayId, matchDate, kickoffTime);
            }
          }

          if (target?.status === "FT" && isNonPlayedStatus(effectiveParsed.status)) {
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
            source_url: appendKnockoutMetaToSourceUrl(normalizeFlashUrl(item.url), knockoutMeta),
            updated_at: new Date().toISOString(),
          };

          if (isNonPlayedStatus(effectiveParsed.status)) {
            payload.home_score = null;
            payload.away_score = null;
          } else {
            payload.home_score = hs;
            payload.away_score = as;
          }

          if (target?.id && !touchedIds.has(target.id)) {
            const patch: Record<string, unknown> = { ...payload };

            if (target.status === "FT" && isNonPlayedStatus(patch.status as MatchStatus)) {
              continue;
            }

            const { error } = await ensureSupabase()
              .from("matches")
              .update(patch)
              .eq("id", target.id);

            if (error) {
              totalFailures++;
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
              totalFailures++;
              console.log("WARN: save by source_event_key failed:", e instanceof Error ? e.message : e);
            }
          }
        }

        if (!MATCHES_ONLY && !LIVE_ONLY && groupIndex === 0) {
          try {
          console.log("Open standings:", variants.standings);
          await gotoWithRetry(page, variants.standings, 3);
          await maybeAcceptConsent(page);
          // Finished competitions often open the playoff draw rather than the points table.
          // Select the source's explicit Main phase; do not derive ranks from a knockout bracket.
          const mainPhase=page.getByText(/^main$/i,{exact:true}).first();
          await mainPhase.waitFor({state:"visible",timeout:8000}).catch(()=>{});
          if(await mainPhase.count()){
            await maybeAcceptConsent(page);
            await mainPhase.click({timeout:8000});
          }
          try {await page.waitForSelector('.table__row, .ui-table__row, [class*="tableRow"], [class*="standing"] [class*="row"]',{timeout:20000});}catch{}
          await page.waitForTimeout(1200);

          const standings = await scrapeStandingsPage(page);
          console.log(`Standings scraped: ${standings.length}`);

          if (!standings.length && STANDINGS_ONLY) {
            console.log("Standings diagnostic:", (await page.locator("body").innerText()).slice(-6000));
            throw new Error(`Empty standings for ${compSlug}`);
          }
          if (standings.length > 0) {
            await upsertStandingsCache(seasonMeta.seasonId, teamsMap, teamNamesNorm, standings, compSlug);
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
            if(STANDINGS_ONLY)totalFailures++;
          }
        }

        if (!LIVE_ONLY && CLEANUP_PLACEHOLDER_DUPLICATES) {
          const cleanedHere = await cleanupPlaceholderMidnightDuplicates(seasonMeta.seasonId);
          if (cleanedHere > 0) {
            console.log(`Cleaned placeholder midnight duplicates in ${compSlug}: ${cleanedHere}`);
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
    }
  } finally {
    await browser.close();
  }

  console.log("\nTOTAL updated matches:", totalUpdates);
  console.log("TOTAL inserted/upserted matches:", totalInsertedOrUpserted);
  if (totalFailures) throw new Error(`Sync completed with ${totalFailures} failures; review the competition logs.`);
  console.log("DONE ✅");
}

main().catch((e) => {
  console.error("ERROR ❌", e);
  process.exit(1);
});
