import { isSevenCompetition } from "@/lib/competitionPrefs";

export type MatchStatus = "NS" | "LIVE" | "HT" | "FT";

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

function getMatchTimingRules(competitionSlug?: string | null): MatchTimingRules {
  if (competitionSlug && isSevenCompetition(competitionSlug.toLowerCase())) {
    return SEVENS_RULES;
  }

  return FIFTEENS_RULES;
}

function getTotalLiveWindowMinutes(rules: MatchTimingRules) {
  return rules.firstHalfMinutes + rules.halftimeMinutes + rules.secondHalfMinutes;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

export function getEffectiveMatchState(
  status: MatchStatus,
  matchDate: string,
  kickoffTime?: string | null,
  explicitMinute?: number | null,
  competitionSlug?: string | null,
  now = new Date()
) {
  const rules = getMatchTimingRules(competitionSlug);
  const halftimeStart = rules.firstHalfMinutes;
  const secondHalfStart = rules.firstHalfMinutes + rules.halftimeMinutes;
  const totalLiveWindowMinutes = getTotalLiveWindowMinutes(rules);

  if (status === "FT") {
    return { status: "FT" as const, minute: null as number | null };
  }

  if (status === "HT") {
    return { status: "HT" as const, minute: null as number | null };
  }

  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  const diffMinutes = kickoff ? Math.floor((now.getTime() - kickoff.getTime()) / 60000) : null;

  if (status === "LIVE") {
    if (explicitMinute != null && explicitMinute > 0) {
      return { status: "LIVE" as const, minute: clamp(explicitMinute, 1, rules.maxDisplayMinute) };
    }

    if (diffMinutes == null) {
      return { status: "LIVE" as const, minute: null as number | null };
    }

    if (diffMinutes >= halftimeStart && diffMinutes < secondHalfStart) {
      return { status: "HT" as const, minute: null as number | null };
    }

    if (diffMinutes < 0 || diffMinutes > totalLiveWindowMinutes) {
      return { status: "LIVE" as const, minute: null as number | null };
    }

    if (diffMinutes < rules.firstHalfMinutes) {
      return { status: "LIVE" as const, minute: clamp(diffMinutes + 1, 1, rules.firstHalfMinutes) };
    }

    return {
      status: "LIVE" as const,
      minute: clamp(
        diffMinutes - rules.halftimeMinutes + 1,
        rules.firstHalfMinutes + 1,
        rules.maxDisplayMinute
      ),
    };
  }

  if (diffMinutes == null || diffMinutes < 0 || diffMinutes > totalLiveWindowMinutes) {
    return { status: "NS" as const, minute: explicitMinute ?? null };
  }

  if (diffMinutes < rules.firstHalfMinutes) {
    return {
      status: "LIVE" as const,
      minute:
        explicitMinute != null && explicitMinute > 0
          ? clamp(explicitMinute, 1, rules.firstHalfMinutes)
          : clamp(diffMinutes + 1, 1, rules.firstHalfMinutes),
    };
  }

  if (diffMinutes < secondHalfStart) {
    return { status: "HT" as const, minute: null as number | null };
  }

  return {
    status: "LIVE" as const,
    minute:
      explicitMinute != null && explicitMinute > 0
        ? clamp(explicitMinute, rules.firstHalfMinutes + 1, rules.maxDisplayMinute)
        : clamp(diffMinutes - rules.halftimeMinutes + 1, rules.firstHalfMinutes + 1, rules.maxDisplayMinute),
  };
}
