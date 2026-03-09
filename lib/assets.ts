export function getTeamLogo(teamSlug?: string | null) {
  if (!teamSlug) return "/team-logos/_placeholder.png";
  return `/team-logos/${teamSlug}.png`;
}

export function getLeagueLogo(compSlug?: string | null) {
  if (!compSlug) return "/league-logos/_placeholder.png";
  return `/league-logos/${compSlug}.png`;
}