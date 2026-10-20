// A date, score or kickoff is never evidence of a competition round.
export function parseSourceRound(roundLabel: string, context = ""): number | null {
  const dedicated = roundLabel.trim();
  if (/^\d{1,2}\.?$/.test(dedicated)) {
    const value = Number.parseInt(dedicated, 10);
    return value > 0 ? value : null;
  }
  for (const text of [dedicated, context]) {
    const match = text.match(/\b(?:round|fecha|jornada|week|journée)\s*[:#-]?\s*(\d{1,2})(?!\d)/i);
    if (match && Number(match[1]) > 0) return Number(match[1]);
  }
  return null;
}
