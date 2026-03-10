export function getCompetitionEmoji(slug?: string | null, groupName?: string | null, countryCode?: string | null) {
  const s = (slug || "").toLowerCase();

  if (s === "int-six-nations") return "🏆";
  if (s === "int-world-cup") return "🌍";
  if (s === "int-nations-championship") return "🌐";
  if (s === "eu-champions-cup") return "⭐";
  if (s === "int-super-rugby-pacific") return "🏉";
  if (s === "int-united-rugby-championship") return "🇪🇺";
  if (s === "sra") return "🏉";
  if (s === "us-mlr") return "🇺🇸";
  if (s === "fr-top14") return "🇫🇷";
  if (s === "it-serie-a-elite") return "🇮🇹";
  if (s === "en-premiership-rugby") return "🏉";
  if (s === "ar-urba-top14") return "🇦🇷";
  if (s === "ar-liga-norte-grande") return "🇦🇷";
  if (s.startsWith("svns-")) return "7️⃣";

  if (countryCode === "AR") return "🇦🇷";
  if (countryCode === "US") return "🇺🇸";
  if (countryCode === "FR") return "🇫🇷";
  if (countryCode === "IT") return "🇮🇹";

  const group = (groupName || "").toLowerCase();
  if (group === "europe") return "🇪🇺";
  if (group === "seven") return "7️⃣";
  if (group === "international") return "🌍";

  return "🏉";
}
