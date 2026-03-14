export type LogicalMatchStatus = "NS" | "LIVE" | "FT" | string;

export type LogicalMatchShape = {
  id: number;
  matchDate: string;
  kickoffTime: string | null;
  status: LogicalMatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

type StandingShape = {
  played: number | null;
  won: number | null;
  drawn: number | null;
  lost: number | null;
};

export function isPlaceholderKickoffTime(kickoffTime?: string | null) {
  return !kickoffTime || kickoffTime === "00:00:00" || kickoffTime === "00:00";
}

function parseMatchDateTime(matchDate: string, kickoffTime?: string | null) {
  const normalizedTime = kickoffTime && kickoffTime.length === 5 ? `${kickoffTime}:00` : kickoffTime || "00:00:00";
  const parsed = new Date(`${matchDate}T${normalizedTime}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minutesBetweenMatchSlots(left: LogicalMatchShape, right: LogicalMatchShape) {
  const leftDateTime = parseMatchDateTime(left.matchDate, left.kickoffTime);
  const rightDateTime = parseMatchDateTime(right.matchDate, right.kickoffTime);
  if (!leftDateTime || !rightDateTime) return Number.POSITIVE_INFINITY;
  return Math.abs(leftDateTime.getTime() - rightDateTime.getTime()) / 60000;
}

function sameKnownScore(left: LogicalMatchShape, right: LogicalMatchShape) {
  return (
    left.homeScore != null &&
    left.awayScore != null &&
    right.homeScore != null &&
    right.awayScore != null &&
    left.homeScore === right.homeScore &&
    left.awayScore === right.awayScore
  );
}

export function areLogicalMatchDuplicates(left: LogicalMatchShape, right: LogicalMatchShape) {
  if (!left.homeTeamId || !left.awayTeamId || !right.homeTeamId || !right.awayTeamId) return false;
  if (left.homeTeamId !== right.homeTeamId || left.awayTeamId !== right.awayTeamId) return false;

  const minutesApart = minutesBetweenMatchSlots(left, right);
  const closeInTime =
    minutesApart <= 360 || isPlaceholderKickoffTime(left.kickoffTime) || isPlaceholderKickoffTime(right.kickoffTime);

  if (!closeInTime) return false;

  if (left.status === "FT" && right.status === "FT") {
    return sameKnownScore(left, right);
  }

  if (
    left.homeScore != null &&
    left.awayScore != null &&
    right.homeScore != null &&
    right.awayScore != null &&
    !sameKnownScore(left, right)
  ) {
    return false;
  }

  return true;
}

function logicalMatchQuality(row: LogicalMatchShape) {
  let score = 0;

  if (!isPlaceholderKickoffTime(row.kickoffTime)) score += 40;
  if (row.homeScore != null && row.awayScore != null) score += 20;
  if (row.status === "FT") score += 15;
  else if (row.status === "LIVE" || row.status === "HT") score += 10;
  else if (row.status === "CANC") score += 6;
  else if (row.status === "NS") score += 5;

  return score;
}

export function dedupeLogicalMatches<T>(rows: T[], toLogicalShape: (row: T) => LogicalMatchShape): T[] {
  const indexed = rows.map((row, index) => ({ row, index, shape: toLogicalShape(row) }));
  const selected: Array<(typeof indexed)[number]> = [];

  for (const candidate of indexed.slice().sort((left, right) => {
    const qualityDelta = logicalMatchQuality(right.shape) - logicalMatchQuality(left.shape);
    if (qualityDelta !== 0) return qualityDelta;
    return right.shape.id - left.shape.id;
  })) {
    if (selected.some((existing) => areLogicalMatchDuplicates(existing.shape, candidate.shape))) {
      continue;
    }
    selected.push(candidate);
  }

  return selected
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.row);
}

export function hasConsistentStandingsCache<T>(rows: T[], toStandingShape: (row: T) => StandingShape) {
  if (!rows.length) return false;

  return rows.every((row) => {
    const { played, won, drawn, lost } = toStandingShape(row);
    const values = [played, won, drawn, lost];

    if (values.some((value) => value != null && value < 0)) return false;

    const hasAny = values.some((value) => value != null);
    if (!hasAny) return false;

    if (values.some((value) => value == null)) return false;

    const safePlayed = played as number;
    const safeWon = won as number;
    const safeDrawn = drawn as number;
    const safeLost = lost as number;

    return safePlayed === safeWon + safeDrawn + safeLost;
  });
}
