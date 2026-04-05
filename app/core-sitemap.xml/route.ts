import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site";

const CORE_PATHS = [
  "",
  "/leagues",
  "/weekly",
  "/about",
  "/privacy",
  "/terms",
  "/rugby-results",
  "/rugby-fixtures",
  "/rugby-live-scores",
  "/rugby-matches",
  "/six-nations-standings",
  "/super-rugby-results",
  "/leagues/int-six-nations",
  "/leagues/eu-challenge-cup",
  "/leagues/int-super-rugby-pacific",
  "/leagues/int-united-rugby-championship",
  "/leagues/fr-top14",
  "/leagues/sra",
  "/leagues/ar-urba-top14",
  "/leagues/ar-liga-norte-grande",
  "/leagues/us-mlr",
  "/teams/penarol-rugby",
  "/teams/selknam",
  "/teams/leinster",
  "/teams/crusaders",
];

export function GET() {
  const siteUrl = getSiteUrl();
  const lastModified = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${CORE_PATHS.map(
  (path) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <lastmod>${lastModified}</lastmod>
  </url>`
).join("\n")}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
