type PhaseKey = "round32" | "round16" | "quarterfinal" | "semifinal" | "final";

export type DerivedRoundMeta = {
  round: number;
  first_date: string;
  last_date: string;
  matches: number;
  ft: number;
  phaseKey: string | null;
  stageLabel: string | null;
};

type RoundInput = {
  id: number;
  match_date: string;
  kickoff_time: string | null;
  status: string;
  round?: number | null;
  source_url?: string | null;
};

function daysBetween(leftIso: string, rightIso: string) {
  const left = new Date(`${leftIso}T00:00:00Z`);
  const right = new Date(`${rightIso}T00:00:00Z`);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(left.getTime() - right.getTime()) / 86400000;
}

export function parseKnockoutMetaFromSourceUrl(sourceUrl?: string | null): { phaseKey: PhaseKey | null; stageLabel: string | null } {
  if (!sourceUrl) return { phaseKey: null, stageLabel: null };

  try {
    const url = new URL(sourceUrl);
    const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
    const params = new URLSearchParams(hash);
    return {
      phaseKey: (params.get("rn_phase") as PhaseKey | null) ?? null,
      stageLabel: params.get("rn_stage") ?? null,
    };
  } catch {
    const params = new URLSearchParams(sourceUrl.split("#")[1] ?? "");
    return {
      phaseKey: (params.get("rn_phase") as PhaseKey | null) ?? null,
      stageLabel: params.get("rn_stage") ?? null,
    };
  }
}

export function phaseSortOrder(phaseKey: PhaseKey) {
  if (phaseKey === "round32") return 10;
  if (phaseKey === "round16") return 20;
  if (phaseKey === "quarterfinal") return 30;
  if (phaseKey === "semifinal") return 40;
  return 50;
}

export function stageSortOrder(stageLabel?: string | null) {
  const s = (stageLabel || "").toLowerCase();
  if (!s || /play offs?|main|cup/.test(s)) return 0;
  if (/bronze/.test(s)) return 50;
  if (/5th-8th/.test(s)) return 100;
  if (/9th-12th/.test(s)) return 200;
  if (/13th-16th/.test(s)) return 300;
  if (/plate/.test(s)) return 400;
  if (/bowl/.test(s)) return 500;
  if (/shield/.test(s)) return 600;
  return 900;
}

function shouldTrustExplicitRounds(rows: RoundInput[]) {
  const buckets = new Map<number, { first: string; last: string; dates: Set<string> }>();
  let explicitRows = 0;

  for (const row of rows) {
    const knockoutMeta = parseKnockoutMetaFromSourceUrl(row.source_url);
    if (knockoutMeta.phaseKey || row.round == null) continue;
    explicitRows += 1;
    if (!buckets.has(row.round)) {
      buckets.set(row.round, { first: row.match_date, last: row.match_date, dates: new Set([row.match_date]) });
      continue;
    }
    const bucket = buckets.get(row.round)!;
    if (row.match_date < bucket.first) bucket.first = row.match_date;
    if (row.match_date > bucket.last) bucket.last = row.match_date;
    bucket.dates.add(row.match_date);
  }

  if (!explicitRows || !buckets.size) return false;

  for (const bucket of buckets.values()) {
    if (daysBetween(bucket.first, bucket.last) > 10) return false;
    if (bucket.dates.size > 5) return false;
  }

  return true;
}

export function deriveLeagueRoundData<T extends RoundInput>(rows: T[]) {
  const sorted = rows
    .slice()
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) ||
        String(a.kickoff_time || "").localeCompare(String(b.kickoff_time || ""))
    );

  const trustExplicitRounds = shouldTrustExplicitRounds(sorted);
  const roundMap = new Map<number, DerivedRoundMeta>();
  const assignment = new Map<number, number>();
  let lastRegularDate: string | null = null;
  let derivedRound = 0;

  for (const row of sorted) {
    const knockoutMeta = parseKnockoutMetaFromSourceUrl(row.source_url);
    let resolvedRound: number;

    if (knockoutMeta.phaseKey) {
      resolvedRound = 1000 + stageSortOrder(knockoutMeta.stageLabel) + phaseSortOrder(knockoutMeta.phaseKey);
    } else if (trustExplicitRounds && row.round != null) {
      resolvedRound = row.round;
      lastRegularDate = row.match_date;
    } else {
      const gapDays =
        lastRegularDate == null
          ? Number.POSITIVE_INFINITY
          : Math.round(
              (new Date(`${row.match_date}T00:00:00Z`).getTime() - new Date(`${lastRegularDate}T00:00:00Z`).getTime()) /
                86400000
            );

      if (lastRegularDate == null || gapDays > 4) {
        derivedRound += 1;
      }

      resolvedRound = derivedRound;
      lastRegularDate = row.match_date;
    }

    assignment.set(row.id, resolvedRound);
    if (!roundMap.has(resolvedRound)) {
      roundMap.set(resolvedRound, {
        round: resolvedRound,
        first_date: row.match_date,
        last_date: row.match_date,
        matches: 0,
        ft: 0,
        phaseKey: knockoutMeta.phaseKey,
        stageLabel: knockoutMeta.stageLabel,
      });
    }

    const meta = roundMap.get(resolvedRound)!;
    if (row.match_date < meta.first_date) meta.first_date = row.match_date;
    if (row.match_date > meta.last_date) meta.last_date = row.match_date;
    meta.matches += 1;
    if (row.status === "FT") meta.ft += 1;
  }

  return {
    assignment,
    roundMeta: Array.from(roundMap.values()).sort((a, b) => a.first_date.localeCompare(b.first_date) || a.round - b.round),
  };
}

export function attachKnockoutPhaseMeta<T extends { phaseKey?: string | null }>(roundMeta: T[]) {
  return roundMeta.map((item) => ({ ...item, phaseKey: item.phaseKey ?? null }));
}

export function pickAutoRound<T extends { round: number; first_date: string; last_date: string }>(roundMeta: T[], refISO: string) {
  if (!roundMeta.length) return null;
  const current = roundMeta.find((item) => item.first_date <= refISO && refISO <= item.last_date);
  if (current) return current.round;
  const next = roundMeta.find((item) => item.first_date >= refISO);
  if (next) return next.round;
  return roundMeta[roundMeta.length - 1]?.round ?? null;
}
