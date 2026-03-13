export {};

process.env.LIVE_ONLY = "1";
process.env.MATCHES_ONLY = "1";

async function main() {
  await import("./sync-flashscore");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
