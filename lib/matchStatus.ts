export type MatchStatus = "NS" | "LIVE" | "HT" | "FT";

export const FIRST_HALF_MINUTES = 40;
export const HALFTIME_MINUTES = 20;
export const SECOND_HALF_MINUTES = 40;
export const TOTAL_LIVE_WINDOW_MINUTES = FIRST_HALF_MINUTES + HALFTIME_MINUTES + SECOND_HALF_MINUTES;

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
  now = new Date()
) {
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
      return { status: "LIVE" as const, minute: clamp(explicitMinute, 1, 80) };
    }

    if (diffMinutes == null) {
      return { status: "LIVE" as const, minute: null as number | null };
    }

    if (diffMinutes >= FIRST_HALF_MINUTES && diffMinutes < FIRST_HALF_MINUTES + HALFTIME_MINUTES) {
      return { status: "HT" as const, minute: null as number | null };
    }

    if (diffMinutes < 0 || diffMinutes > TOTAL_LIVE_WINDOW_MINUTES) {
      return { status: "LIVE" as const, minute: null as number | null };
    }

    if (diffMinutes < FIRST_HALF_MINUTES) {
      return { status: "LIVE" as const, minute: clamp(diffMinutes + 1, 1, 40) };
    }

    return {
      status: "LIVE" as const,
      minute: clamp(diffMinutes - HALFTIME_MINUTES + 1, 41, 80),
    };
  }

  if (diffMinutes == null || diffMinutes < 0 || diffMinutes > TOTAL_LIVE_WINDOW_MINUTES) {
    return { status: "NS" as const, minute: explicitMinute ?? null };
  }

  if (diffMinutes < FIRST_HALF_MINUTES) {
    return {
      status: "LIVE" as const,
      minute: explicitMinute != null && explicitMinute > 0 ? clamp(explicitMinute, 1, 40) : clamp(diffMinutes + 1, 1, 40),
    };
  }

  if (diffMinutes < FIRST_HALF_MINUTES + HALFTIME_MINUTES) {
    return { status: "HT" as const, minute: null as number | null };
  }

  return {
    status: "LIVE" as const,
    minute:
      explicitMinute != null && explicitMinute > 0
        ? clamp(explicitMinute, 41, 80)
        : clamp(diffMinutes - HALFTIME_MINUTES + 1, 41, 80),
  };
}
