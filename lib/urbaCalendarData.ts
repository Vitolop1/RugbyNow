import stored from '../data/urba-calendar.json';
import snapshot from '../data/supabase-snapshot.json';
export function isUrbaRegularDate(date:string){return date>='2026-03-14'&&date<='2026-10-17';}
export function getUrbaCalendarData(){
 const season=snapshot.seasons.find(s=>s.name===stored.season&&snapshot.competitions.some(c=>c.id===s.competition_id&&c.slug==='ar-urba-top14'));
 if(!season)throw Error('URBA edition identity missing');
 const teams=new Map(snapshot.teams.map(t=>[t.slug,t]));
 const matches=stored.fixtures.map(m=>{
  const home=teams.get(m.homeSlug),away=teams.get(m.awaySlug);if(!home||!away)throw Error('URBA club identity missing');
  const previous=snapshot.matches.find(r=>r.season_id===season.id&&isUrbaRegularDate(r.match_date)&&r.home_team_id===home.id&&r.away_team_id===away.id);
  return {id:previous?.id??-(60000000+m.sourceId),season_id:season.id,match_date:m.date,kickoff_time:previous?.match_date===m.date?previous.kickoff_time:null,status:m.status as 'NS'|'FT',minute:null,home_score:m.homeScore,away_score:m.awayScore,round:m.round,home_team:home,away_team:away,home_team_id:home.id,away_team_id:away.id,venue:previous?.venue||null,source_url:m.sourceUrl,updated_at:stored.checkedAt};
 });
 return {matches,meta:{sourceUrl:stored.sourceUrl,sourceName:stored.sourceName,checkedAt:stored.checkedAt,season:stored.season,total:182,category:'men-xv',phase:'regular'}};
}
