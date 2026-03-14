"use client";

import { getDateLocale } from "@/lib/dateLocale";
import { t } from "@/lib/i18n";
import { getEffectiveMatchState, type MatchStatus } from "@/lib/matchStatus";
import type { Lang } from "@/lib/usePrefs";

type MatchClockInput = {
  status: MatchStatus;
  minute?: number | null;
  matchDate: string;
  kickoffTime?: string | null;
  timeZone: string;
  lang: Lang;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function estimateLiveMinute(
  status: MatchStatus,
  matchDate: string,
  kickoffTime?: string | null,
  explicitMinute?: number | null
) {
  const effective = getEffectiveMatchState(status, matchDate, kickoffTime, explicitMinute);
  if (effective.status !== "LIVE") return null;
  if (effective.minute != null && effective.minute > 0) {
    return clamp(effective.minute, 1, 80);
  }
  return null;
}

export function formatKickoffTZ(matchDate: string, kickoffTime: string | null, timeZone: string, lang: Lang) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  return new Intl.DateTimeFormat(getDateLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(`${matchDate}T${normalized}Z`));
}

export function getLivePhase(lang: Lang, status: MatchStatus, minute?: number | null) {
  if (status === "HT") return t(lang, "halftime");
  if (minute == null) return null;
  return minute <= 40 ? t(lang, "liveFirstHalf") : t(lang, "liveSecondHalf");
}

export function getMatchClockLabel(input: MatchClockInput) {
  const effective = getEffectiveMatchState(input.status, input.matchDate, input.kickoffTime, input.minute);
  if (effective.status === "FT") return t(input.lang, "statusFt");
  if (effective.status === "HT") return t(input.lang, "statusHt");

  if (effective.status === "LIVE") {
    const minute = estimateLiveMinute(effective.status, input.matchDate, input.kickoffTime, effective.minute);
    const phase = getLivePhase(input.lang, effective.status, minute);
    return [t(input.lang, "statusLive"), phase, minute != null ? `${minute}'` : ""].filter(Boolean).join(" ");
  }

  return formatKickoffTZ(input.matchDate, input.kickoffTime ?? null, input.timeZone, input.lang) ?? t(input.lang, "tbd");
}

export function getMatchContextLabel(input: MatchClockInput) {
  const effective = getEffectiveMatchState(input.status, input.matchDate, input.kickoffTime, input.minute);
  if (effective.status === "FT") return t(input.lang, "final");
  if (effective.status === "HT") return t(input.lang, "halftime");

  if (effective.status === "LIVE") {
    const minute = estimateLiveMinute(effective.status, input.matchDate, input.kickoffTime, effective.minute);
    return getLivePhase(input.lang, effective.status, minute) ?? t(input.lang, "liveAction");
  }

  return t(input.lang, "upcoming");
}
