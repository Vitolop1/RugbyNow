import type { Metadata } from "next";
import SeoLandingPage from "@/app/components/SeoLandingPage";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Super Rugby Results, Fixtures and Standings",
  description:
    "Follow Super Rugby Pacific results, fixtures, standings and live scores on RugbyNow.",
  path: "/super-rugby-results",
  keywords: [
    "super rugby results",
    "super rugby standings",
    "super rugby fixtures",
    "super rugby pacific results",
    "super rugby table",
  ],
});

export default function SuperRugbyResultsPage() {
  return (
    <SeoLandingPage
      title="Super Rugby Results"
      description="Results, fixtures and standings for Super Rugby Pacific."
      intro="RugbyNow tracks Super Rugby Pacific results, current standings, fixtures and live score context. This page is designed to target Super Rugby searches and send readers directly into the full competition coverage."
      bullets={[
        "Super Rugby Pacific results and live score coverage",
        "Current standings and table context",
        "Fixtures and round-by-round match coverage",
        "Fast links to teams and competition pages",
      ]}
      primaryLink={{
        href: "/leagues/int-super-rugby-pacific",
        label: "Open Super Rugby coverage",
        description: "Go to the Super Rugby Pacific league page for results, standings, fixtures and teams.",
      }}
      links={[
        {
          href: "/rugby-live-scores",
          label: "Rugby live scores",
          description: "See live rugby score coverage across tracked competitions.",
        },
        {
          href: "/rugby-fixtures",
          label: "Rugby fixtures",
          description: "Browse the upcoming rugby schedule and kickoff times.",
        },
        {
          href: "/leagues",
          label: "All competitions",
          description: "Browse more rugby leagues, tournaments and season pages on RugbyNow.",
        },
      ]}
    />
  );
}
