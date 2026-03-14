"use client";

import { getDateLocale } from "@/lib/dateLocale";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/usePrefs";

export type MatchStatus = "NS" | "LIVE" | "FT";

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

export function estimateLiveMinute(matchDate: string, kickoffTime?: string | null, explicitMinute?: number | null) {
  if (explicitMinute != null && explicitMinute > 0) {
    return clamp(explicitMinute, 1, 90);
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

export function getLivePhase(lang: Lang, minute?: number | null) {
  if (minute == null) return null;
  return minute <= 40 ? t(lang, "liveFirstHalf") : t(lang, "liveSecondHalf");
}

export function getMatchClockLabel(input: MatchClockInput) {
  if (input.status === "FT") return t(input.lang, "statusFt");

  if (input.status === "LIVE") {
    const minute = estimateLiveMinute(input.matchDate, input.kickoffTime, input.minute);
    const phase = getLivePhase(input.lang, minute);
    return [t(input.lang, "statusLive"), phase, minute != null ? `${minute}'` : ""].filter(Boolean).join(" ");
  }

  return formatKickoffTZ(input.matchDate, input.kickoffTime ?? null, input.timeZone, input.lang) ?? t(input.lang, "tbd");
}

export function getMatchContextLabel(input: MatchClockInput) {
  if (input.status === "FT") return t(input.lang, "final");

  if (input.status === "LIVE") {
    const minute = estimateLiveMinute(input.matchDate, input.kickoffTime, input.minute);
    return getLivePhase(input.lang, minute) ?? t(input.lang, "liveAction");
  }

  return t(input.lang, "upcoming");
}
