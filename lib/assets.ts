const TEAM_LOGO_ALIASES: Record<string, string> = {
  "regatas-bella-vista": "regatas",
  "atl-del-rosario": "_placeholder",
  champagnat: "_placeholder",
  "los-matreros": "_placeholder",
};

const LEAGUE_LOGO_PATHS: Record<string, string> = {
  "ar-urba-top14": "/team-logos/ar-urba-top14.png",
  "it-serie-a-elite": "/league-logos/_placeholder.png",
  "en-premiership-rugby": "/league-logos/_placeholder.png",
  "eu-champions-cup": "/league-logos/_placeholder.png",
  "int-world-cup": "/league-logos/_placeholder.png",
  "int-nations-championship": "/league-logos/_placeholder.png",
  "us-mlr": "/league-logos/_placeholder.png",
};

export function getTeamLogo(teamSlug?: string | null) {
  if (!teamSlug) return "/team-logos/_placeholder.png";
  const resolved = TEAM_LOGO_ALIASES[teamSlug] ?? teamSlug;
  return `/team-logos/${resolved}.png`;
}

export function getLeagueLogo(compSlug?: string | null) {
  if (!compSlug) return "/league-logos/_placeholder.png";
  return LEAGUE_LOGO_PATHS[compSlug] ?? `/league-logos/${compSlug}.png`;
}
