type MatchStatus="NS"|"LIVE"|"HT"|"FT"|"CANC";
export function detectStatusAndMinute(
  raw: string,
  hs: number | null,
  as: number | null,
  sourcePage: "results" | "fixtures" | "live"
) {
  const s = (raw || "").toUpperCase().trim();
  const halfMinuteMatch =
    s.match(
      /(?:1ST HALF|FIRST HALF|2ND HALF|SECOND HALF|LIVE)\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:1ST HALF|FIRST HALF|2ND HALF|SECOND HALF|LIVE)\b/
    ) ??
    (sourcePage === "live" ? s.match(/^\s*(\d{1,3})\s*$/) : null);

  if (halfMinuteMatch) {
    const minuteText = halfMinuteMatch[1] || halfMinuteMatch[2] || halfMinuteMatch[3];
    const minute = Number.parseInt(minuteText, 10);
    if (Number.isFinite(minute) && minute > 0 && minute <= 130) {
      return { status: "LIVE" as MatchStatus, minute };
    }
  }

  if (/(POSTP|CANC|CANCEL|ABAND|ABD|AWD|WO)/.test(s)) {
    return { status: "CANC" as MatchStatus, minute: null as number | null };
  }

  if (/(FT|FINAL|AET|AFTER EXTRA TIME)/.test(s)) {
    return { status: "FT" as MatchStatus, minute: null as number | null };
  }

  if (/(HT|HALF TIME|BREAK)/.test(s)) {
    return { status: "HT" as MatchStatus, minute: null as number | null };
  }

  if (/(LIVE|1ST HALF|2ND HALF|SECOND HALF)/.test(s)) {
    return { status: "LIVE" as MatchStatus, minute: null as number | null };
  }

  const minuteMatch = s.match(/(?:^|\s)(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*['’′](?=\s|$)/);
  if (minuteMatch) {
    return {
      status: "LIVE" as MatchStatus,
      minute: Number.parseInt(minuteMatch[1], 10)+(Number.parseInt(minuteMatch[2]||"0",10)),
    };
  }

  if (sourcePage === "results" && hs !== null && as !== null) {
    return { status: "FT" as MatchStatus, minute: null as number | null };
  }

  const timeMatch = s.match(/\b\d{1,2}:\d{2}\b/);
  if (timeMatch) {
    return { status: "NS" as MatchStatus, minute: null as number | null };
  }

  return { status: "NS" as MatchStatus, minute: null as number | null };
}
