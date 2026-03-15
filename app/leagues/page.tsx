import type { Metadata } from "next";
import LeaguesClient from "@/app/leagues/LeaguesClient";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Rugby Leagues, Competitions and Standings",
  description:
    "Browse rugby leagues, competitions, standings, fixtures and results across international and club tournaments on RugbyNow.",
  path: "/leagues",
  keywords: [
    "rugby leagues",
    "rugby competitions",
    "rugby standings",
    "six nations standings",
    "super rugby results",
    "rugby fixtures",
  ],
});

export default function LeaguesPage() {
  return <LeaguesClient />;
}
