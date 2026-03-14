"use client";

import { getDateLocale } from "@/lib/dateLocale";
import { t } from "@/lib/i18n";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";
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

function parseKickoffDateTime(matchDate: string, kickoffTime?: string | null) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  if (!normalized || normalized === "00:00:00" || normalized === "00:00") return null;
  const parsed = new Date(`${matchDate}T${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMatchLocalISODate(matchDate: string, kickoffTime: string | null | undefined, timeZone: string) {
  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return matchDate;
  return getISODateInTimeZone(kickoff, timeZone);
}

export function isEffectivelyLive(
  status: MatchStatus,
  matchDate: string,
  kickoffTime?: string | null,
  now = new Date()
) {
  if (status === "LIVE") return true;
  if (status === "FT") return false;

  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return false;

  const diffMinutes = Math.floor((now.getTime() - kickoff.getTime()) / 60000);
  return diffMinutes >= 0 && diffMinutes <= 130;
}

export function estimateLiveMinute(matchDate: string, kickoffTime?: string | null, explicitMinute?: number | null) {
  if (explicitMinute != null && explicitMinute > 0) {
    return clamp(explicitMinute, 1, 90);
  }
  const kickoff = parseKickoffDateTime(matchDate, kickoffTime);
  if (!kickoff) return null;
  const diffMinutes = Math.floor((Date.now() - kickoff.getTime()) / 60000);
  if (diffMinutes < 0 || diffMinutes > 130) return null;
  return clamp(diffMinutes + 1, 1, 90);
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

  if (isEffectivelyLive(input.status, input.matchDate, input.kickoffTime)) {
    const minute = estimateLiveMinute(input.matchDate, input.kickoffTime, input.minute);
    const phase = getLivePhase(input.lang, minute);
    return [t(input.lang, "statusLive"), phase, minute != null ? `${minute}'` : ""].filter(Boolean).join(" ");
  }

  return formatKickoffTZ(input.matchDate, input.kickoffTime ?? null, input.timeZone, input.lang) ?? t(input.lang, "tbd");
}

export function getMatchContextLabel(input: MatchClockInput) {
  if (input.status === "FT") return t(input.lang, "final");

  if (isEffectivelyLive(input.status, input.matchDate, input.kickoffTime)) {
    const minute = estimateLiveMinute(input.matchDate, input.kickoffTime, input.minute);
    return getLivePhase(input.lang, minute) ?? t(input.lang, "liveAction");
  }

  return t(input.lang, "upcoming");
}
