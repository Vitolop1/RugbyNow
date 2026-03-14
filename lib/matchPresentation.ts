"use client";

import { getDateLocale } from "@/lib/dateLocale";
import { isSevenCompetition } from "@/lib/competitionPrefs";
import { t } from "@/lib/i18n";
import { getEffectiveMatchState, type MatchStatus } from "@/lib/matchStatus";
import type { Lang } from "@/lib/usePrefs";

type MatchClockInput = {
  competitionSlug?: string | null;
  status: MatchStatus;
  minute?: number | null;
  updatedAt?: string | null;
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
  explicitMinute?: number | null,
  competitionSlug?: string | null,
  updatedAt?: string | null
) {
  const maxMinute = competitionSlug && isSevenCompetition(competitionSlug.toLowerCase()) ? 14 : 80;
  const firstHalfLimit = competitionSlug && isSevenCompetition(competitionSlug.toLowerCase()) ? 7 : 40;
  const effective = getEffectiveMatchState(status, matchDate, kickoffTime, explicitMinute, competitionSlug, updatedAt);
  if (effective.status !== "LIVE") return null;
  if (effective.minute != null && effective.minute > 0) {
    return clamp(effective.minute, 1, maxMinute);
  }
  return null;
}

function estimateMinuteFromScrapeTimestamp(
  minute: number,
  updatedAt?: string | null,
  competitionSlug?: string | null,
  now = new Date()
) {
  if (!updatedAt) return minute;

  const parsedUpdatedAt = new Date(updatedAt);
  if (Number.isNaN(parsedUpdatedAt.getTime())) return minute;

  const elapsedMinutes = Math.floor((now.getTime() - parsedUpdatedAt.getTime()) / 60000);
  if (elapsedMinutes <= 0) return minute;

  const isSeven = competitionSlug && isSevenCompetition(competitionSlug.toLowerCase());
  const firstHalfLimit = isSeven ? 7 : 40;
  const maxMinute = isSeven ? 14 : 80;
  const halfCap = minute <= firstHalfLimit ? firstHalfLimit : maxMinute;

  return clamp(minute + elapsedMinutes, 1, halfCap);
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

export function getLivePhase(lang: Lang, status: MatchStatus, minute?: number | null, competitionSlug?: string | null) {
  if (status === "HT") return t(lang, "halftime");
  if (minute == null) return null;
  const firstHalfLimit = competitionSlug && isSevenCompetition(competitionSlug.toLowerCase()) ? 7 : 40;
  return minute <= firstHalfLimit ? t(lang, "liveFirstHalf") : t(lang, "liveSecondHalf");
}

export function getMatchClockLabel(input: MatchClockInput) {
  const effective = getEffectiveMatchState(
    input.status,
    input.matchDate,
    input.kickoffTime,
    input.minute,
    input.competitionSlug,
    input.updatedAt
  );
  if (effective.status === "CANC") return t(input.lang, "statusCanc");
  if (effective.status === "FT") return t(input.lang, "statusFt");
  if (effective.status === "HT") return t(input.lang, "statusHt");

  if (effective.status === "LIVE") {
    const estimatedMinute = estimateLiveMinute(
      effective.status,
      input.matchDate,
      input.kickoffTime,
      effective.minute,
      input.competitionSlug,
      input.updatedAt
    );
    const minute =
      estimatedMinute != null
        ? estimateMinuteFromScrapeTimestamp(estimatedMinute, input.updatedAt, input.competitionSlug)
        : null;
    const phase = getLivePhase(input.lang, effective.status, minute, input.competitionSlug);
    return [t(input.lang, "statusLive"), phase, minute != null ? `${minute}'` : ""].filter(Boolean).join(" ");
  }

  return formatKickoffTZ(input.matchDate, input.kickoffTime ?? null, input.timeZone, input.lang) ?? t(input.lang, "tbd");
}

export function getMatchContextLabel(input: MatchClockInput) {
  const effective = getEffectiveMatchState(
    input.status,
    input.matchDate,
    input.kickoffTime,
    input.minute,
    input.competitionSlug,
    input.updatedAt
  );
  if (effective.status === "CANC") return t(input.lang, "cancelled");
  if (effective.status === "FT") return t(input.lang, "final");
  if (effective.status === "HT") return t(input.lang, "halftime");

  if (effective.status === "LIVE") {
    const estimatedMinute = estimateLiveMinute(
      effective.status,
      input.matchDate,
      input.kickoffTime,
      effective.minute,
      input.competitionSlug,
      input.updatedAt
    );
    const minute =
      estimatedMinute != null
        ? estimateMinuteFromScrapeTimestamp(estimatedMinute, input.updatedAt, input.competitionSlug)
        : null;
    return getLivePhase(input.lang, effective.status, minute, input.competitionSlug) ?? t(input.lang, "liveAction");
  }

  return t(input.lang, "upcoming");
}
