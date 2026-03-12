"use client";

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

  if (!kickoffTime) return null;

  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  const kickoff = new Date(`${matchDate}T${normalized}`);
  const elapsed = Math.floor((Date.now() - kickoff.getTime()) / 60000);

  if (!Number.isFinite(elapsed) || elapsed <= 0) return null;

  const adjusted = elapsed <= 40 ? elapsed : elapsed - 10;
  return clamp(adjusted, 1, 90);
}

export function formatKickoffTZ(matchDate: string, kickoffTime: string | null, timeZone: string) {
  if (!kickoffTime) return null;
  const normalized = kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(`${matchDate}T${normalized}`));
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

  return formatKickoffTZ(input.matchDate, input.kickoffTime ?? null, input.timeZone) ?? t(input.lang, "tbd");
}

export function getMatchContextLabel(input: MatchClockInput) {
  if (input.status === "FT") return t(input.lang, "final");

  if (input.status === "LIVE") {
    const minute = estimateLiveMinute(input.matchDate, input.kickoffTime, input.minute);
    return getLivePhase(input.lang, minute) ?? t(input.lang, "liveAction");
  }

  return t(input.lang, "upcoming");
}
