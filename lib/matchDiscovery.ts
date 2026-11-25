type Feed = {compSlug: string | null; url: string};

export function hasDiscoveryIdentities(home:number|null,away:number|null,seasonTeamIds:ReadonlySet<number>){
  return home!==null && away!==null && home>0 && away>0 && home!==away && seasonTeamIds.has(home) && seasonTeamIds.has(away);
}

// One fixture page per live run, independently of existing matches. GitHub's
// schedule is best effort: this is a bounded rotation, not a coverage guarantee.
export function selectDiscoveryFeed<T extends Feed>(feeds: T[], active: T[], now = Date.now()): T | null {
  const unique = [...new Map(feeds.map(feed => [feed.url, feed])).values()].sort((a,b) => a.url.localeCompare(b.url));
  if (!unique.length) return null;
  const offset = Math.floor(now / 300000) % unique.length;
  const activeUrls = new Set(active.map(feed => feed.url));
  const rotated = [...unique.slice(offset), ...unique.slice(0,offset)];
  return rotated.find(feed => !activeUrls.has(feed.url)) ?? rotated[0];
}

export function isDiscoverableFixture(row: {status: string; matchDate: string | null; sourceId: string | null}, now = Date.now()) {
  if (row.status !== 'NS' || !row.matchDate || !row.sourceId || !/^\d{4}-\d{2}-\d{2}$/.test(row.matchDate)) return false;
  const day = Date.parse(`${row.matchDate}T00:00:00Z`);
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0,10) !== row.matchDate) return false;
  const today = Date.parse(new Date(now).toISOString().slice(0,10));
  return day >= today && day <= today + 14 * 86400000;
}
