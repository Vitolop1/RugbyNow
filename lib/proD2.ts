import { sourceTeamName } from "./sourceTeamIdentity";

// Edition and identities verified against the official LNR 2026/2027 calendar.
// Source: https://prod2.lnr.fr/calendrier-et-resultats
export const PRO_D2_COMPETITION = {
  slug: "fr-pro-d2",
  name: "Pro D2",
  region: "France",
  country_code: "FR",
  group_name: "France",
  sort_order: 2,
  is_featured: false,
  season_name: "2026/2027",
  flashscoreUrl: "https://www.flashscore.com/rugby-union/france/pro-d2/",
} as const;

export const PRO_D2_TEAMS = [
  { name: "Agen", slug: "agen", officialName: "SU Agen", aliases: ["Agen", "SU Agen", "SU Agen Lot-et-Garonne"] },
  { name: "Aurillac", slug: "aurillac", officialName: "Stade Aurillacois", aliases: ["Aurillac", "Stade Aurillacois", "Stade Aurillacois Cantal Auvergne"] },
  { name: "Beziers", slug: "beziers", officialName: "AS Béziers Hérault", aliases: ["Beziers", "Béziers", "AS Béziers Hérault", "AS Beziers"] },
  { name: "Biarritz", slug: "biarritz", officialName: "Biarritz Olympique PB", aliases: ["Biarritz", "Biarritz Olympique", "Biarritz Olympique PB", "Biarritz Olympique Pays Basque"] },
  { name: "Brive", slug: "brive", officialName: "CA Brive", aliases: ["Brive", "CA Brive", "CA Brive Corrèze Limousin"] },
  { name: "Colomiers", slug: "colomiers", officialName: "Colomiers Rugby", aliases: ["Colomiers", "Colomiers Rugby", "US Colomiers"] },
  { name: "Dax", slug: "dax", officialName: "US Dax", aliases: ["Dax", "US Dax"] },
  { name: "Grenoble", slug: "grenoble", officialName: "FC Grenoble Rugby", aliases: ["Grenoble", "FC Grenoble", "FC Grenoble Rugby"] },
  { name: "Montauban", slug: "montauban", officialName: "US Montauban", aliases: ["Montauban", "US Montauban"] },
  { name: "Narbonne", slug: "narbonne", officialName: "RC Narbonnais", aliases: ["Narbonne", "RC Narbonne", "RC Narbonnais", "Racing Club Narbonnais"] },
  { name: "Nevers", slug: "nevers", officialName: "USON Nevers", aliases: ["Nevers", "USON Nevers", "USON Nevers Rugby"] },
  { name: "Nice", slug: "nice", officialName: "Nissa Rugby", aliases: ["Nice", "Nissa Rugby", "Stade Nicois", "Stade Niçois", "Stade Niçois Rugby"] },
  { name: "Oyonnax", slug: "oyonnax", officialName: "Oyonnax Rugby", aliases: ["Oyonnax", "Oyonnax Rugby", "US Oyonnax"] },
  { name: "Provence Rugby", slug: "provence-rugby", officialName: "Provence Rugby", aliases: ["Provence Rugby", "Provence", "Aix-en-Provence"] },
  { name: "Soyaux Angouleme", slug: "soyaux-angouleme", officialName: "Soyaux-Angoulême XV", aliases: ["Soyaux Angouleme", "Soyaux-Angouleme", "Soyaux-Angoulême XV", "Soyaux Angouleme XV", "Angouleme"] },
  { name: "Valence Romans", slug: "valence-romans", officialName: "Valence Romans", aliases: ["Valence Romans", "Valence-Romans", "Valence Romans Drome Rugby", "Valence Romans Drôme Rugby"] },
] as const;

const byAlias = new Map(PRO_D2_TEAMS.flatMap((team) => team.aliases.map((alias) => [sourceTeamName(alias), team] as const)));

export function getProD2Team(name: string) {
  return byAlias.get(sourceTeamName(name)) ?? null;
}

export function canonicalProD2TeamName(name: string) {
  return getProD2Team(name)?.name ?? name.trim();
}

export function applyProD2TeamAliases(teams: Map<string, number>) {
  for (const team of PRO_D2_TEAMS) {
    const existingId = team.aliases.map((alias) => teams.get(sourceTeamName(alias))).find((id) => id != null);
    if (existingId == null) continue;
    for (const alias of team.aliases) teams.set(sourceTeamName(alias), existingId);
  }
}
