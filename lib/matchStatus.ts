import { isSevenCompetition } from "@/lib/competitionPrefs";

export type MatchStatus = "NS" | "LIVE" | "HT" | "FT" | "CANC";

type MatchTimingRules = {
  firstHalfMinutes: number;
  halftimeMinutes: number;
  secondHalfMinutes: number;
  maxDisplayMinute: number;
};

const FIFTEENS_RULES: MatchTimingRules = {
  firstHalfMinutes: 40,
  halftimeMinutes: 20,
  secondHalfMinutes: 40,
  maxDisplayMinute: 80,
};

const SEVENS_RULES: MatchTimingRules = {
  firstHalfMinutes: 7,
  halftimeMinutes: 2,
  secondHalfMinutes: 7,
  maxDisplayMinute: 14,
};

const AUTO_FINALIZE_BUFFER_MINUTES = 5;
function getMatchTimingRules(competitionSlug?: string | null): MatchTimingRules {
  if (competitionSlug && isSevenCompetition(competitionSlug.toLowerCase())) {
    return SEVENS_RULES;
  }

  return FIFTEENS_RULES;
}

function getTotalLiveWindowMinutes(rules: MatchTimingRules) {
  return rules.firstHalfMinutes + rules.halftimeMinutes + rules.secondHalfMinutes;
}

export function parseKickoffDateTime(matchDate: string, kickoffTime?: string | null) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  if (!normalized) return null;
  const parsed = new Date(`${matchDate}T${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isActiveMatchStatus(status: MatchStatus) {
  return status === "LIVE" || status === "HT";
}

export function isScheduledMatchStatus(status: MatchStatus) {
  return status === "NS" || status === "CANC";
}

export function getEffectiveMatchState(
  status: MatchStatus,
  matchDate: string,
  kickoffTime?: string | null,
  explicitMinute?: number | null,
  competitionSlug?: string | null,
  updatedAt?: string | null,
  now = new Date()
) {
  // Only source-confirmed states are presented as live/half-time/final.
  // A scheduled kickoff passing does not establish that play has started.
  return { status, minute: status === "LIVE" ? explicitMinute ?? null : null };
}

export function shouldAutoFinalizeMatch(
  status: MatchStatus,
  matchDate: string,
  kickoffTime?: string | null,
  homeScore?: number | null,
  awayScore?: number | null,
  competitionSlug?: string | null,
  now = new Date()
) {
  if (status === "FT" || status === "CANC") return false;
  if (homeScore == null || awayScore == null) return false;

  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return false;

  const rules = getMatchTimingRules(competitionSlug);
  const elapsedMinutes = Math.floor((now.getTime() - kickoff.getTime()) / 60000);
  const totalWindow = getTotalLiveWindowMinutes(rules) + AUTO_FINALIZE_BUFFER_MINUTES;

  return elapsedMinutes >= totalWindow;
}

export function isResultPendingMatch(
  status: MatchStatus,
  matchDate: string,
  kickoffTime?: string | null,
  homeScore?: number | null,
  awayScore?: number | null,
  competitionSlug?: string | null,
  now = new Date()
) {
  if (status === "FT" || status === "CANC") return false;
  if (homeScore != null || awayScore != null) return false;

  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return false;

  const rules = getMatchTimingRules(competitionSlug);
  const elapsedMinutes = Math.floor((now.getTime() - kickoff.getTime()) / 60000);
  const totalWindow = getTotalLiveWindowMinutes(rules);

  return elapsedMinutes > totalWindow;
}
