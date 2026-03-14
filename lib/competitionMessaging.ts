import type { MatchStatus } from "@/lib/matchStatus";

type ManualStatusOverrideInput = {
  competitionSlug?: string | null;
  matchDate: string;
  status: MatchStatus;
  homeTeamSlug?: string | null;
  awayTeamSlug?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  now?: Date;
};

const OVERRIDE_TIME_ZONE = "America/New_York";

function getMinutesInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const hour = Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10);
  const minute = Number.parseInt(parts.find((part) => part.type === "minute")?.value ?? "0", 10);

  return hour * 60 + minute;
}

function getDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getCompetitionNoticeKey(competitionSlug?: string | null) {
  if (competitionSlug === "ar-liga-norte-grande") return "resultsAtFinalNotice";
  return null;
}

export function getManualStatusOverride(input: ManualStatusOverrideInput) {
  if (input.competitionSlug !== "ar-liga-norte-grande") return null;
  if (input.status !== "NS") return null;
  if (input.homeScore != null || input.awayScore != null) return null;

  const isTargetMatch =
    input.matchDate === "2026-03-14" &&
    input.homeTeamSlug === "santiago-lawn-tennis-club" &&
    input.awayTeamSlug === "tigres-rc";

  if (!isTargetMatch) return null;

  const now = input.now ?? new Date();
  const localDate = getDateInTimeZone(now, OVERRIDE_TIME_ZONE);
  if (localDate !== "2026-03-14") return null;

  const minutes = getMinutesInTimeZone(now, OVERRIDE_TIME_ZONE);
  const liveStart = 14 * 60;
  const liveEnd = 15 * 60 + 30;

  if (minutes < liveStart || minutes > liveEnd) return null;

  return {
    status: "LIVE" as const,
    minute: null as number | null,
  };
}
