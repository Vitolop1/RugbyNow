// Source names must resolve to a known name/explicit alias. Substring matching
// confused Lions (South Africa) with Old Lions RC (Argentina).
export function sourceTeamName(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/’/g,"'").replace(/\s+/g," ").trim();
}
export function resolveExactSourceTeam(rawName: string,teams: Map<string,number>) {
  return teams.get(sourceTeamName(rawName)) ?? null;
}
