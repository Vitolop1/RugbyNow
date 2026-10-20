import fs from "node:fs/promises";
import path from "node:path";
import { parseLnrProD2Broadcasts } from "../lib/lnrBroadcasts";
import type { ConfirmedMatchBroadcast } from "../lib/matchBroadcasts";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find(arg => arg.startsWith("--file="))?.slice(7);
  const source = args.find(arg => arg.startsWith("--source="))?.slice(9) ?? "https://prod2.lnr.fr/calendrier-et-resultats";
  const url = new URL(source);
  if (url.origin !== "https://prod2.lnr.fr" || !/^\/calendrier-et-resultats(?:\/\d{4}-\d{4}\/j\d+)?\/?$/.test(url.pathname)) {
    throw new Error("Only official LNR Pro D2 calendar sources are accepted");
  }
  const response = file ? null : await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (response && !response.ok) throw new Error(`LNR returned HTTP ${response.status}`);
  const html = file ? await fs.readFile(file, "utf8") : await response!.text();
  const now = new Date().toISOString();
  const listings = parseLnrProD2Broadcasts(html, now);
  const target = path.join(process.cwd(), "data", "match-broadcasts.json");
  const previous = JSON.parse(await fs.readFile(target, "utf8")) as { listings: ConfirmedMatchBroadcast[] };
  const editions = new Set(listings.map(item => item.season));
  const roundKeys = new Set(listings.map(item => new URL(item.sourceUrl).pathname.split("/").slice(0, 4).join("/")));
  const kept = previous.listings.filter(item => !roundKeys.has(new URL(item.sourceUrl).pathname.split("/").slice(0, 4).join("/")) &&
    (item.competitionSlug !== "fr-pro-d2" || editions.has(item.season)));
  const combined = [...kept, ...listings].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  await fs.writeFile(`${target}.tmp`, JSON.stringify({ updatedAt: now, listings: combined }, null, 2) + "\n", "utf8");
  await fs.rename(`${target}.tmp`, target);
  console.log(`Confirmed broadcasts: ${listings.length} refreshed, ${combined.length} stored (France, LNR Pro D2).`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
