type SeasonBounds = { startYear: number; endYear: number };

export type ScrapedDateContext = {
  statusOrTime: string;
  rawText: string;
  dateLabel: string;
  sectionText: string;
  sourceSeasonName?: string;
};

export function seasonYearBounds(name: string): SeasonBounds | null {
  const range = name.match(/\b((?:19|20)\d{2})\s*[/-]\s*(\d{2}|(?:19|20)\d{2})\b/);
  if (range) {
    const startYear = Number(range[1]);
    let endYear = Number(range[2]);
    if (range[2].length === 2) {
      endYear += Math.floor(startYear / 100) * 100;
      if (endYear < startYear) endYear += 100;
    }
    return endYear >= startYear && endYear - startYear <= 1 ? { startYear, endYear } : null;
  }
  const year = name.match(/\b((?:19|20)\d{2})\b/);
  return year ? { startYear: Number(year[1]), endYear: Number(year[1]) } : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseDate(text: string, seasonName: string, explicitOnly = false) {
  const iso = text.match(/\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Flashscore uses day.month, while the existing English feed uses month/day.
  const dotted = text.match(/\b(\d{1,2})\.(\d{1,2})(?:\.((?:19|20)\d{2}))?\.?(?!\d)/);
  const slash = !/\b(?:de final|play-?offs?)\b/i.test(text)
    ? text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/((?:19|20)\d{2}))?\b/)
    : null;
  const named = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:,?\s+((?:19|20)\d{2}))?\b/i);
  const dayFirst = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:,?\s+((?:19|20)\d{2}))?\b/i);
  const match = dotted ?? slash ?? named ?? dayFirst;
  if (!match || (explicitOnly && !match[3])) return null;

  const month = match === named ? MONTHS[match[1].slice(0, 3).toLowerCase()]
    : match === dayFirst ? MONTHS[match[2].slice(0, 3).toLowerCase()]
    : Number(match === slash ? match[1] : match[2]);
  const day = Number(match === named || match === slash ? match[2] : match[1]);
  const bounds = seasonYearBounds(seasonName);
  const year = match[3] ? Number(match[3]) : bounds ? (month >= 7 ? bounds.startYear : bounds.endYear) : null;
  return year == null ? null : isoDate(year, month, day);
}

export function inferMatchDateFromRawText(text: string, seasonName: string) {
  return parseDate(text, seasonName);
}

export function inferMatchDateFromScrapedRow(row: ScrapedDateContext, seasonName: string, now = new Date(), allowRelativeDates = true) {
  const contexts = [row.statusOrTime, row.rawText, row.dateLabel, row.sectionText];
  // A complete date elsewhere in the row must beat a yearless time/date label.
  for (const context of contexts) {
    const explicit = parseDate(context, seasonName, true);
    if (explicit) return explicit;
  }
  for (const context of contexts) {
    const date = parseDate(context, row.sourceSeasonName || seasonName);
    if (date) return date;
  }
  if (!allowRelativeDates) return null;
  const text = contexts.join(" | ").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let offset: number;
  if (/\b(today|hoy|oggi|aujourd'hui)\b/i.test(text)) offset = 0;
  else if (/\b(yesterday|ayer|ieri|hier)\b/i.test(text)) offset = -1;
  else if (/\b(tomorrow|manana|demain|domani)\b/i.test(text)) offset = 1;
  else return null;
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function dateFitsSeason(date: string, seasonName: string) {
  const bounds = seasonYearBounds(seasonName);
  if (!bounds) return false;
  const year = Number(date.slice(0, 4));
  return year >= bounds.startYear && year <= bounds.endYear;
}

export function selectSeasonForScrapedRow<T extends { id: number; name: string }>(seasons: T[], row: ScrapedDateContext) {
  const sourceBounds = row.sourceSeasonName ? seasonYearBounds(row.sourceSeasonName) : null;
  const explicitDate = inferMatchDateFromScrapedRow(row, "Current");
  // Never put a historical results page into the upcoming fixtures edition.
  const matching = seasons.filter((season) => {
    const bounds = seasonYearBounds(season.name);
    if (!bounds) return false;
    if (sourceBounds && (bounds.startYear !== sourceBounds.startYear || bounds.endYear !== sourceBounds.endYear)) return false;
    return !explicitDate || dateFitsSeason(explicitDate, season.name);
  });
  if (sourceBounds || explicitDate) {
    return matching.sort((a, b) => {
      const left = seasonYearBounds(a.name)!;
      const right = seasonYearBounds(b.name)!;
      return (left.endYear - left.startYear) - (right.endYear - right.startYear) || right.endYear - left.endYear;
    })[0] ?? null;
  }
  // Without a page edition or a full date, more than one edition is ambiguous.
  return matching.length === 1 ? matching[0] : null;
}
