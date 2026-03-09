export function countryCodeToEmoji(code?: string | null) {
  if (!code) return "🏉";

  const clean = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return "🏉";

  return String.fromCodePoint(
    ...[...clean].map((char) => 127397 + char.charCodeAt(0))
  );
}

export function getLeagueFlag(slug?: string | null, region?: string | null) {
  const s = (slug ?? "").toLowerCase();

  if (s === "fr-top14") return "🇫🇷";
  if (s === "it-serie-a-elite") return "🇮🇹";
  if (s === "en-premiership-rugby") return "🇬🇧";
  if (s === "ar-urba-top14") return "🇦🇷";
  if (s === "us-mlr") return "🇺🇸";

  if (s === "int-six-nations") return "🌍";
  if (s === "eu-champions-cup") return "🇪🇺";
  if (s === "int-world-cup") return "🏆";
  if (s === "int-nations-championship") return "🌐";
  if (s === "int-super-rugby-pacific") return "🌏";
  if (s === "sra") return "🌎";

  const r = (region ?? "").toLowerCase();

  if (r.includes("france")) return "🇫🇷";
  if (r.includes("italy")) return "🇮🇹";
  if (r.includes("england")) return "🇬🇧";
  if (r.includes("argentina")) return "🇦🇷";
  if (r.includes("usa")) return "🇺🇸";
  if (r.includes("international")) return "🌍";
  if (r.includes("europe")) return "🇪🇺";
  if (r.includes("americas")) return "🌎";

  return "🏉";
}

export function normalizeCountryName(name?: string | null) {
  const n = (name ?? "").trim().toLowerCase();

  const map: Record<string, string> = {
    england: "GB",
    france: "FR",
    ireland: "IE",
    italy: "IT",
    scotland: "GB",
    wales: "GB",
    argentina: "AR",
    australia: "AU",
    belgium: "BE",
    brazil: "BR",
    canada: "CA",
    chile: "CL",
    fiji: "FJ",
    "hong kong": "HK",
    japan: "JP",
    georgia: "GE",
    namibia: "NA",
    "new zealand": "NZ",
    portugal: "PT",
    romania: "RO",
    samoa: "WS",
    "south africa": "ZA",
    spain: "ES",
    tonga: "TO",
    uruguay: "UY",
    usa: "US",
    "united states": "US",
    zimbabwe: "ZW",
  };

  return map[n] ?? null;
}

export function isNationalTeam(name?: string | null) {
  return normalizeCountryName(name) !== null;
}

export function getTeamFlag(name?: string | null) {
  const code = normalizeCountryName(name);
  if (!code) return null;
  return countryCodeToEmoji(code);
}