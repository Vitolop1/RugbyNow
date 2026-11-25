// Retry reads, never replay writes. Access restrictions must not trigger a loop.
export function sourceRetryDelay(status: number, attempt: number, retryAfter: string | null = null, now = Date.now()) {
  if (attempt >= 2 || (status !== 0 && status !== 429 && status < 500)) return null;
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter ?? '') - now;
  // A long provider cooldown belongs to the next scheduled run, not a tight loop.
  if (requested > 5000) return null;
  return Math.max(1000 * attempt, Number.isFinite(requested) ? requested : 0);
}

export async function readNonEmptyStandings<T>(read: (attempt: number) => Promise<T[]>) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const rows = await read(attempt);
    if (rows.length) return rows;
  }
  throw Error('Empty standings after 2 complete page reads; previous table preserved');
}
