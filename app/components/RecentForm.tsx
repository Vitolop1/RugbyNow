"use client";
import type {Lang} from "@/lib/usePrefs";
import Link from "next/link";
export type RecentGame={id:number;date:string;opponent:string;score:string;href:string;result:string};
export default function RecentForm({form,lang,games=[]}:{form?:string[];lang:Lang;games?:RecentGame[]}){
 const text={es:{W:"Ganado",D:"Empatado",L:"Perdido",label:"Últimos cinco partidos, del más reciente al más antiguo",empty:"Sin resultados confirmados"},en:{W:"Won",D:"Drawn",L:"Lost",label:"Last five matches, newest first",empty:"No confirmed results"},fr:{W:"Gagné",D:"Nul",L:"Perdu",label:"Cinq derniers matchs, du plus récent au plus ancien",empty:"Aucun résultat confirmé"},it:{W:"Vinto",D:"Pareggio",L:"Perso",label:"Ultime cinque partite, dalla più recente",empty:"Nessun risultato confermato"}}[lang];
 const valid=(games.length?games.map(g=>g.result):form||[]).filter((v):v is "W"|"D"|"L"=>v==="W"||v==="D"||v==="L").slice(0,5);
 const badges=<span className="rn-form" aria-label={text.label} title={text.label}>{valid.length?valid.map((value,index)=><span key={index} className={`rn-form-${value}`} title={`${index+1}. ${text[value]}${games[index]?` · ${games[index].date} · ${games[index].opponent} ${games[index].score}`:""}`} aria-label={text[value]}>{lang==="es"?({W:"G",D:"E",L:"P"}[value]):value}</span>):<span className="rn-form-empty" title={text.empty}>—</span>}</span>;
 return games.length?<details className="rn-recent-details"><summary>{badges}<span>⌄</span></summary><ol>{games.map(game=><li key={game.id}><Link href={game.href}><time>{game.date.slice(5).split("-").reverse().join("/")}</time><span>{game.opponent}</span><b>{game.score}</b></Link></li>)}</ol></details>:badges;
}
