function emoji(codePoint: number) {
  return String.fromCodePoint(codePoint);
}

function flag(countryCode: string) {
  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

const TROPHY = emoji(0x1f3c6);
const GLOBE = emoji(0x1f30d);
const WORLD = emoji(0x1f310);
const STAR = emoji(0x2b50);
const RUGBY = emoji(0x1f3c9);
const SEVEN = "7\uFE0F\u20E3";
const SOUTH_AMERICA = emoji(0x1f30e);
const CLUBS = emoji(0x1f3df);

export function getCompetitionEmoji(slug?: string | null, groupName?: string | null, countryCode?: string | null) {
  const s = (slug || "").toLowerCase();

  if (s === "int-six-nations") return TROPHY;
  if (s === "int-world-cup") return GLOBE;
  if (s === "int-nations-championship") return WORLD;
  if (s === "eu-challenge-cup") return STAR;
  if (s === "eu-champions-cup") return STAR;
  if (s === "int-super-rugby-pacific") return RUGBY;
  if (s === "int-united-rugby-championship") return flag("EU");
  if (s === "sra") return RUGBY;
  if (s === "us-mlr") return flag("US");
  if (s === "fr-top14") return flag("FR");
  if (s === "it-serie-a-elite") return flag("IT");
  if (s === "en-premiership-rugby") return RUGBY;
  if (s.startsWith("ar-")) return flag("AR");
  if (s.startsWith("svns-")) return SEVEN;

  if (countryCode === "AR") return flag("AR");
  if (countryCode === "US") return flag("US");
  if (countryCode === "FR") return flag("FR");
  if (countryCode === "IT") return flag("IT");

  const group = (groupName || "").toLowerCase();
  if (group === "europe" || group === "europa") return flag("EU");
  if (group === "seven") return SEVEN;
  if (group === "south america" || group === "sudamerica") return SOUTH_AMERICA;
  if (group === "argentina") return flag("AR");
  if (group === "international selections" || group === "internacional selecciones") return GLOBE;
  if (group === "international clubs" || group === "internacional clubes") return CLUBS;
  if (group === "international") return GLOBE;

  return RUGBY;
}

export function getCompetitionGroupEmoji(groupKey: string) {
  if (groupKey === "argentina") return flag("AR");
  if (groupKey === "southAmerica") return SOUTH_AMERICA;
  if (groupKey === "europe") return flag("EU");
  if (groupKey === "internationalSelections") return GLOBE;
  if (groupKey === "internationalClubs") return CLUBS;
  if (groupKey === "seven") return SEVEN;
  if (groupKey === "usa") return flag("US");
  return RUGBY;
}

export function getCompetitionGroupIconPath(groupKey: string) {
  if (groupKey === "internationalSelections") return "/league-logos/int-world-cup.png";
  if (groupKey === "internationalClubs") return "/league-logos/eu-champions-cup.png";
  if (groupKey === "seven") return "/league-logos/Rugby_World_Cup_Sevens_logo.png";
  return null;
}
