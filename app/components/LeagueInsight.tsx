import {leagueInsight} from '@/lib/leagueInsight';
import type {LeagueViewPayload} from '@/app/leagues/[slug]/CompactLeagueClient';
export default function LeagueInsight({data,lang}:{data:LeagueViewPayload;lang:'es'|'en'|'fr'|'it'}){
 const stats=leagueInsight(data.matches);if(!stats)return null;
 const n=new Intl.NumberFormat(lang,{maximumFractionDigits:1});
 const text={
  es:`En los ${stats.played} resultados disponibles de ${data.season?.name||'esta edición'} se anotaron ${n.format(stats.points)} puntos: ${n.format(stats.average)} por encuentro y ${stats.draws} empates.`,
  en:`The ${stats.played} available results for ${data.season?.name||'this edition'} contain ${n.format(stats.points)} points: ${n.format(stats.average)} per match and ${stats.draws} draws.`,
  fr:`Les ${stats.played} résultats disponibles pour ${data.season?.name||'cette édition'} totalisent ${n.format(stats.points)} points : ${n.format(stats.average)} par match et ${stats.draws} matchs nuls.`,
  it:`I ${stats.played} risultati disponibili per ${data.season?.name||'questa edizione'} contengono ${n.format(stats.points)} punti: ${n.format(stats.average)} per partita e ${stats.draws} pareggi.`,
 };
 return <p className="rn-league-insight">{text[lang]} <a href="/sources">{({es:'Ver cobertura',en:'View coverage',fr:'Voir la couverture',it:'Vedi copertura'})[lang]} →</a></p>;
}
