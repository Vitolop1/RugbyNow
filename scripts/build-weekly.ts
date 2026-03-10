import { buildWeeklyDigest, writeWeeklyDigest } from "@/lib/weeklyDigest";

async function main() {
  const payload = await buildWeeklyDigest();
  writeWeeklyDigest(payload);
  console.log(
    `Weekly digest written: leagues=${payload.leagues.length}, articles=${payload.leagues.reduce((sum, league) => sum + league.articles.length, 0)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
