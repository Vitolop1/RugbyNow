export function getCompetitionEmoji(slug?: string | null, groupName?: string | null, countryCode?: string | null) {
  const s = (slug || "").toLowerCase();

  if (s === "int-six-nations") return "🏆";
  if (s === "int-world-cup") return "🌍";
  if (s === "int-nations-championship") return "🌐";
  if (s === "eu-champions-cup") return "⭐";
  if (s === "int-super-rugby-pacific") return "🏉";
  if (s === "sra") return "🏉";
  if (s === "us-mlr") return "🇺🇸";
  if (s === "fr-top14") return "🇫🇷";
  if (s === "it-serie-a-elite") return "🇮🇹";
  if (s === "ar-urba-top14") return "🇦🇷";
  if (s === "ar-liga-norte-grande") return "🇦🇷";

  if (countryCode === "AR") return "🇦🇷";
  if (countryCode === "US") return "🇺🇸";
  if (countryCode === "FR") return "🇫🇷";
  if (countryCode === "IT") return "🇮🇹";

  if ((groupName || "").toLowerCase() === "international") return "🌍";

  return "🏉";
}