// Deliberately small discovery set. Player directories stay accessible from squads.
// An export/check timestamp is not a meaningful content modification date.
export const SEARCH_CORE_PATHS = [
  '', '/leagues', '/news', '/watch', '/sources', '/weekly', '/about',
  '/advertise', '/games', '/privacy', '/terms', '/rugby-results', '/rugby-fixtures',
];
type IndexSnapshot = {
  competitions: {id:number;slug:string}[];
  seasons: {id:number;competition_id:number}[];
  teams: {id:number;slug:string|null}[];
  matches: {season_id:number;home_team_id:number|null;away_team_id:number|null}[];
};
export function searchPaths(snapshot:IndexSnapshot) {
  const seasons=new Set(snapshot.matches.map(m=>m.season_id));
  const competitions=new Set(snapshot.seasons.filter(s=>seasons.has(s.id)).map(s=>s.competition_id));
  const teams=new Set(snapshot.matches.flatMap(m=>[m.home_team_id,m.away_team_id]));
  return [...new Set([
    ...SEARCH_CORE_PATHS,
    ...snapshot.competitions.filter(c=>competitions.has(c.id)).map(c=>`/leagues/${c.slug}`),
    ...snapshot.teams.filter(t=>t.slug&&teams.has(t.id)).map(t=>`/teams/${t.slug}`),
  ])];
}
