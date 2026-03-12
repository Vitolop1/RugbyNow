const TEAM_LOGO_ALIASES: Record<string, string> = {
  argentina: "argentina",
  "argentina-7s": "argentina",
  australia: "australia",
  "australia-7s": "australia",
  "atl-del-rosario": "atletico-del-rosario",
  bath: "bath",
  bristol: "bristol",
  brumbies: "brumbies",
  canada: "canada",
  "canada-7s": "canada",
  capibaras: "capibaras-xv",
  champagnat: "champagnat",
  clermont: "asm-clermont-auvergne",
  cobras: "cobras-brasil-rugby",
  emilia: "valorugby-emilia",
  "exeter-chiefs": "exeter-chiefs",
  fiji: "fiji",
  "fiji-7s": "fiji",
  "great-britain": "great-britain",
  "great-britain-7s": "great-britain",
  "glasgow-warriors": "glasgow-warriors",
  gloucester: "gloucester",
  harlequins: "harlequins",
  "hong-kong": "hong-kong",
  "hong-kong-china": "hong-kong",
  "hong-kong-china-7s": "hong-kong",
  japan: "japan",
  "leicester-tigers": "leicester-tigers",
  "los-matreros": "los-matreros",
  montpellier: "montpellier-herault-rugby",
  "new-zealand": "new-zealand",
  "new-zealand-7s": "new-zealand",
  "new-zealand-sevens": "new-zealand",
  "newcastle-red-bulls": "newcastle-falcons",
  penarol: "penarol-rugby",
  "petrarca-padova": "petrarca",
  "rc-toulonnais": "rc-toulonnais",
  "regatas-bella-vista": "regatas-bella-vista",
  "rugby-lyons": "lyons-piacenza",
  "sale-sharks": "sale-sharks",
  samoa: "samoa",
  "samoa-7s": "samoa",
  saracens: "saracens",
  sharks: "sharks",
  "south-africa": "south-africa",
  "south-africa-7s": "south-africa",
  spain: "spain",
  "spain-7s": "spain",
  "stade-francais-paris": "stade-francais",
  uruguay: "uruguay",
  "uruguay-7s": "uruguay",
  usa: "usa",
  "usa-7s": "usa",
};

const LEAGUE_LOGO_ALIASES: Record<string, string> = {
  "ar-liga-norte-grande": "ar-liga-norte-grande",
  "ar-urba-top14": "ar-urba-top14",
  "en-premiership-rugby": "en-premiership-rugby",
  "eu-champions-cup": "eu-champions-cup",
  "int-nations-championship": "int-nations-championship",
  "int-world-cup": "int-world-cup",
  "it-serie-a-elite": "it-serie-a-elite",
  "int-united-rugby-championship": "united-rugby-championship",
  "us-mlr": "us-mlr",
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
