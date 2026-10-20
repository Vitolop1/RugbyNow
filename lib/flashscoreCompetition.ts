// Keep the importer and live selector aligned when a feed is configured by URL.
export function competitionSlugFromFlashscoreUrl(raw: string) {
  const url = new URL(raw);
  const [sport, country, competition] = url.pathname.split("/").filter(Boolean);
  if (sport !== "rugby-union" && sport !== "rugby") return null;
  if (competition === "top-14") return country === "argentina" ? "ar-urba-top14" : country === "france" ? "fr-top14" : null;
  if (competition === "pro-d2") return country === "france" ? "fr-pro-d2" : null;
  const slugs: Record<string, string> = {
    "serie-a-elite": "it-serie-a-elite", "six-nations": "int-six-nations",
    "super-rugby-americas": "sra", "premiership-rugby": "en-premiership-rugby",
    "european-rugby-champions-cup": "eu-champions-cup", "challenge-cup": "eu-challenge-cup",
    "world-cup": "int-world-cup", "nations-championship": "int-nations-championship",
    "super-rugby": "int-super-rugby-pacific", "united-rugby-championship": "int-united-rugby-championship",
    "major-league-rugby": "us-mlr", "svns-australia": "svns-australia", "svns-usa": "svns-usa",
    "svns-hong-kong": "svns-hong-kong", "svns-singapore": "svns-singapore",
  };
  return slugs[competition] ?? null;
}
