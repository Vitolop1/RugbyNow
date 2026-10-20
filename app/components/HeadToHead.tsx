"use client";

import Link from "next/link";
import type { HeadToHeadData, HeadToHeadGame } from "@/lib/headToHead";
import type { Lang } from "@/lib/usePrefs";
import s from "./headToHead.module.css";

const COPY = {
  es: { title: "Últimos enfrentamientos", wins: "Victorias", draws: "Empates", losses: "Derrotas", marks: ["G", "E", "P"], note: "Hasta 5 resultados previos disponibles. Cobertura parcial; el resumen corresponde a estos partidos.", empty: "Todavía no tenemos resultados previos verificados entre estos equipos." },
  en: { title: "Previous meetings", wins: "Wins", draws: "Draws", losses: "Losses", marks: ["W", "D", "L"], note: "Up to 5 available previous results. Partial coverage; the summary covers these matches.", empty: "We do not yet have verified previous results between these teams." },
  fr: { title: "Dernières confrontations", wins: "Victoires", draws: "Nuls", losses: "Défaites", marks: ["V", "N", "D"], note: "Jusqu’à 5 résultats précédents disponibles. Couverture partielle ; le bilan concerne ces rencontres.", empty: "Nous n’avons pas encore de résultats précédents vérifiés entre ces équipes." },
  it: { title: "Precedenti", wins: "Vittorie", draws: "Pareggi", losses: "Sconfitte", marks: ["V", "P", "S"], note: "Fino a 5 risultati precedenti disponibili. Copertura parziale; il bilancio riguarda queste partite.", empty: "Non abbiamo ancora risultati precedenti verificati tra queste squadre." },
};

function formatDate(game: HeadToHeadGame, lang: Lang, timeZone: string) {
  const date = new Date(game.startsAt ?? `${game.matchDate}T12:00:00Z`);
  return new Intl.DateTimeFormat(lang, { day: "2-digit", month: "short", year: "numeric", timeZone: game.startsAt ? timeZone : "UTC" }).format(date);
}

export default function HeadToHead({ data, lang, timeZone }: { data?: HeadToHeadData | null; lang: Lang; timeZone: string }) {
  if (!data) return null;
  const c = COPY[lang];
  return <section className={s.panel} aria-label={c.title}>
    <h2>{c.title}</h2>
    <p className={s.note}>{c.note}</p>
    {!data.matches.length ? <p className={s.empty}>{c.empty}</p> : <>
      <div className={s.summary}>
        {[{ team: data.homeTeam, won: data.summary.homeWins, lost: data.summary.awayWins },
          { team: data.awayTeam, won: data.summary.awayWins, lost: data.summary.homeWins }].map(item => <div key={item.team.id}>
          <span>{item.team.name}</span>
          <p className={s.record} aria-label={`${c.wins}: ${item.won}; ${c.draws}: ${data.summary.draws}; ${c.losses}: ${item.lost}`}>
            <strong title={c.wins}>{item.won} {c.marks[0]}</strong><strong title={c.draws}>{data.summary.draws} {c.marks[1]}</strong><strong title={c.losses}>{item.lost} {c.marks[2]}</strong>
          </p>
        </div>)}
      </div>
      <ul className={s.list}>{data.matches.map(game => <li key={game.id}>
        <Link href={`/matches/${game.competition.slug}/${game.id}`} className={s.game}>
          <span className={s.context}><time dateTime={game.startsAt ?? game.matchDate}>{formatDate(game, lang, timeZone)}</time><small>{game.competition.name}</small></span>
          <span className={s.teams}><span>{game.homeTeam.name}</span><strong>{game.homeScore} – {game.awayScore}</strong><span>{game.awayTeam.name}</span></span>
        </Link>
      </li>)}</ul>
    </>}
  </section>;
}
