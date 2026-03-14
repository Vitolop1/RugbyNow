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
  competitionSlug?: string | null
) {
  const maxMinute = competitionSlug && isSevenCompetition(competitionSlug.toLowerCase()) ? 14 : 80;
  const firstHalfLimit = competitionSlug && isSevenCompetition(competitionSlug.toLowerCase()) ? 7 : 40;
  const effective = getEffectiveMatchState(status, matchDate, kickoffTime, explicitMinute, competitionSlug);
  if (effective.status !== "LIVE") return null;
  if (effective.minute != null && effective.minute > 0) {
    return clamp(effective.minute, 1, maxMinute);
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
    input.competitionSlug
  );
  if (effective.status === "FT") return t(input.lang, "statusFt");
  if (effective.status === "HT") return t(input.lang, "statusHt");

  if (effective.status === "LIVE") {
    const minute = estimateLiveMinute(
      effective.status,
      input.matchDate,
      input.kickoffTime,
      effective.minute,
      input.competitionSlug
    );
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
    input.competitionSlug
  );
  if (effective.status === "FT") return t(input.lang, "final");
  if (effective.status === "HT") return t(input.lang, "halftime");

  if (effective.status === "LIVE") {
    const minute = estimateLiveMinute(
      effective.status,
      input.matchDate,
      input.kickoffTime,
      effective.minute,
      input.competitionSlug
    );
    return getLivePhase(input.lang, effective.status, minute, input.competitionSlug) ?? t(input.lang, "liveAction");
  }

  return t(input.lang, "upcoming");
}
