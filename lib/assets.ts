const TEAM_LOGO_ALIASES: Record<string, string> = {
  "atl-del-rosario": "_placeholder",
  bath: "_placeholder",
  bristol: "_placeholder",
  brumbies: "act-brumbies",
  capibaras: "capibaras-xv",
  champagnat: "_placeholder",
  clermont: "asm-clermont-auvergne",
  "exeter-chiefs": "_placeholder",
  "glasgow-warriors": "glasgow",
  gloucester: "_placeholder",
  harlequins: "_placeholder",
  "leicester-tigers": "_placeholder",
  "los-matreros": "_placeholder",
  penarol: "penarol-rugby",
  "petrarca-padova": "_placeholder",
  "rc-toulonnais": "toulon",
  "regatas-bella-vista": "regatas",
  "rugby-lyons": "_placeholder",
  "sale-sharks": "_placeholder",
  saracens: "_placeholder",
  sharks: "the-sharks",
  "stade-francais-paris": "stade-francais",
};

const LEAGUE_LOGO_ALIASES: Record<string, string> = {
  "ar-liga-norte-grande": "_placeholder",
  "ar-urba-top14": "team:ar-urba-top14",
  "en-premiership-rugby": "_placeholder",
  "eu-champions-cup": "_placeholder",
  "int-nations-championship": "_placeholder",
  "int-world-cup": "_placeholder",
  "it-serie-a-elite": "_placeholder",
  "us-mlr": "_placeholder",
};

export function resolveTeamLogoSlug(teamSlug?: string | null) {
  if (!teamSlug) return "_placeholder";
  return TEAM_LOGO_ALIASES[teamSlug] ?? teamSlug;
}

export function resolveLeagueLogoPath(compSlug?: string | null) {
  if (!compSlug) return "/league-logos/_placeholder.png";

  const resolved = LEAGUE_LOGO_ALIASES[compSlug];
  if (!resolved) return `/league-logos/${compSlug}.png`;
  if (resolved.startsWith("team:")) return `/team-logos/${resolved.slice(5)}.png`;
  return `/league-logos/${resolved}.png`;
}

export function getTeamLogo(teamSlug?: string | null) {
  return `/team-logos/${resolveTeamLogoSlug(teamSlug)}.png`;
}

export function getLeagueLogo(compSlug?: string | null) {
  return resolveLeagueLogoPath(compSlug);
}
