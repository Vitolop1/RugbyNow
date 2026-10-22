import { competitionSlugFromFlashscoreUrl } from "../lib/flashscoreCompetition";
import {readAllRows} from "../lib/readAllRows";
import {isLiveRefreshCandidate,assessLiveCoverage} from "../lib/liveRefresh";
import {selectDiscoveryFeed} from "../lib/matchDiscovery";
import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readRuntimeEnv } from "../lib/runtimeEnv";

loadEnvConfig(process.cwd());

type MatchStatus = "NS" | "LIVE" | "HT" | "FT" | "CANC";

type FlashInput = {
  compSlug: string | null;
  url: string;
};

type LiveMatchCandidate = {
  id:number;
  season_id: number | null;
  source_url: string | null;
  status: MatchStatus | null;
  match_date: string;
  kickoff_time: string | null;
};

type SeasonRow = {
  id: number;
  competition_id: number | null;
};

type CompetitionRow = {
  id: number;
  slug: string;
};

process.env.LIVE_ONLY = "1";
process.env.MATCHES_ONLY = "1";

function normalizeFlashUrl(raw: string) {
  const url = new URL(raw.trim());
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function parseFlashInputs(raw: string | undefined) {
  if (!raw) {
    throw new Error("Missing env var: FLASH_URLS");
  }

  const tokens = raw
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  const inputs: FlashInput[] = [];

  for (const token of tokens) {
    const eqIndex = token.indexOf("=");
    if (eqIndex > 0) {
      const compSlug = token.slice(0, eqIndex).trim() || null;
      const url = token.slice(eqIndex + 1).trim();
      inputs.push({ compSlug, url: normalizeFlashUrl(url) });
      continue;
    }

    inputs.push({ compSlug: competitionSlugFromUrl(token), url: normalizeFlashUrl(token) });
  }

  return inputs;
}

const competitionSlugFromUrl = competitionSlugFromFlashscoreUrl;

async function buildLiveOnlyFlashUrls() {
  const flashInputs = parseFlashInputs(readRuntimeEnv("FLASH_URLS") ?? process.env.FLASH_URLS);
  const supabaseUrl = readRuntimeEnv("SUPABASE_URL") ?? process.env.SUPABASE_URL;
  const serviceRoleKey =
    readRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY") ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase env vars for live runner");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const rawMatches=await readAllRows<LiveMatchCandidate>((offset,size)=>supabase.from("matches").select("id,season_id,source_url,status,match_date,kickoff_time").gte("match_date",yesterday.toISOString().slice(0,10)).lte("match_date",tomorrow.toISOString().slice(0,10)).neq("status","FT").order("id").range(offset,offset+size-1));
  const candidates=rawMatches.filter(row=>isLiveRefreshCandidate(row));

  if (!candidates.length) {
    return {inputs:[],flashInputs,candidates,supabase};
  }

  const inputsBySlug = new Map<string, FlashInput>();
  const inputsByUrl = new Map<string, FlashInput>();

  for (const input of flashInputs) {
    inputsByUrl.set(input.url, input);
    if (input.compSlug) {
      inputsBySlug.set(input.compSlug, input);
    }
  }

  const activeInputs = new Map<string, FlashInput>();
  const unresolvedSeasonIds = new Set<number>();

  for (const candidate of candidates) {
    const sourceUrl = candidate.source_url ? normalizeFlashUrl(candidate.source_url) : null;
    if (sourceUrl && inputsByUrl.has(sourceUrl)) {
      const match = inputsByUrl.get(sourceUrl)!;
      activeInputs.set(match.url, match);
      continue;
    }

    if (candidate.season_id) {
      unresolvedSeasonIds.add(candidate.season_id);
    }
  }

  if (unresolvedSeasonIds.size > 0) {
    const seasonIds = Array.from(unresolvedSeasonIds);
    const { data: rawSeasons, error: seasonsError } = await supabase
      .from("seasons")
      .select("id,competition_id")
      .in("id", seasonIds);

    if (seasonsError) throw seasonsError;

    const seasons = (rawSeasons as SeasonRow[] | null) ?? [];
    const competitionIds = Array.from(
      new Set(seasons.map((season) => season.competition_id).filter((value): value is number => Number.isInteger(value)))
    );

    const competitionsById = new Map<number, CompetitionRow>();

    if (competitionIds.length > 0) {
      const { data: rawCompetitions, error: competitionsError } = await supabase
        .from("competitions")
        .select("id,slug")
        .in("id", competitionIds);

      if (competitionsError) throw competitionsError;

      for (const competition of ((rawCompetitions as CompetitionRow[] | null) ?? [])) {
        competitionsById.set(competition.id, competition);
      }
    }

    for (const season of seasons) {
      if (!season.competition_id) continue;
      const competition = competitionsById.get(season.competition_id);
      if (!competition) continue;
      const input = inputsBySlug.get(competition.slug);
      if (!input) continue;
      activeInputs.set(input.url, input);
    }
  }

  return {inputs:flashInputs.filter((input) => activeInputs.has(input.url)),flashInputs,candidates,supabase};
}

async function runFeeds(inputs:FlashInput[],reportDir:string,discovery:boolean){
 return new Promise<number|null>((resolve,reject)=>{
  const child=spawn(process.execPath,[path.resolve("node_modules/tsx/dist/cli.mjs"),"scripts/sync-matches.ts"],{
   env:{...process.env,FLASH_URLS:inputs.map(input=>input.compSlug?`${input.compSlug}=${input.url}`:input.url).join('\n'),
    LIVE_ONLY:discovery?'0':'1',DISCOVERY_ONLY:discovery?'1':'0',STANDINGS_ONLY:'0',MATCHES_ONLY:'1',
    IMPORT_HEALTH_DIR:path.join(reportDir,discovery?'discovery':'sources')},stdio:'inherit'});
  child.once('error',reject);child.once('close',resolve);
 });
}

async function main() {
  const reportDir=path.resolve(process.env.LIVE_HEALTH_DIR||"logs/live-health");
  fs.mkdirSync(reportDir,{recursive:true});
  const startedAt=new Date().toISOString();
  const report:Record<string,unknown>={startedAt,dryRun:process.env.DRY_RUN==="1",status:"failed",candidates:0,competitions:[]};
  try{
    const {inputs:activeInputs,flashInputs,candidates,supabase}=await buildLiveOnlyFlashUrls();
    report.candidates=candidates.length;report.competitions=activeInputs.map(input=>input.compSlug??input.url);
    const failures:string[]=[];
    if(candidates.length&&!activeInputs.length)failures.push("Live candidates have no configured feed. Coverage is unverified.");
    console.log("sync:live -> active competitions:",report.competitions);
    // Await a separate process: dynamic import of a self-starting script does not
    // await its main(), and cannot reliably propagate its failure/health report.
    const code=activeInputs.length?await runFeeds(activeInputs,reportDir,false):null;
    report.exitCode=code;
    if(activeInputs.length&&code!==0)failures.push("Live source validation/import failed; see per-source reports.");
    // Discovery is independent of a pre-existing DB candidate and does not
    // refresh results. One bounded fixture page, after the urgent live pass.
    const discovery=selectDiscoveryFeed(flashInputs,activeInputs);
    if(discovery){
      const discoveryExit=await runFeeds([discovery],reportDir,true);
      report.discovery={competition:discovery.compSlug,exitCode:discoveryExit,horizonDays:14,maxFeeds:1};
      if(discoveryExit!==0)failures.push("Fixture discovery failed; existing data preserved.");
    }
    const ids=candidates.filter(row=>row.status==="LIVE"||row.status==="HT").map(row=>row.id);
    const observed=ids.length&&process.env.DRY_RUN!=="1"?await readAllRows<{id:number;updated_at:string|null}>((offset,size)=>supabase.from("matches").select("id,updated_at").in("id",ids).order("id").range(offset,offset+size-1)):[];
    const coverage=assessLiveCoverage(candidates,observed,startedAt);report.coverage=coverage;
    if(process.env.DRY_RUN!=="1"&&coverage.unverifiedMatchIds.length)failures.push("Some source-live fixtures were not refreshed during this run.");
    if(failures.length){report.status="degraded";throw Error(failures.join(' '));}
    report.status=!candidates.length?"discovery_only":process.env.DRY_RUN==="1"?"validated_sources":"completed";
  }catch(error){
    report.error=error instanceof Error?error.message:"Live sync failed";
    throw error;
  }finally{
    report.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(reportDir,"run.json"),JSON.stringify(report,null,2)+"\n");
    console.log("Live run report:",JSON.stringify(report));
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Live sync failed");process.exitCode=1;});
