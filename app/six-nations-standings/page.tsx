import type { Metadata } from "next";
import SeoLandingPage from "@/app/components/SeoLandingPage";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Six Nations Standings, Table, Fixtures and Results",
  description:
    "Follow the Six Nations standings, table, fixtures, results and current championship picture on RugbyNow.",
  path: "/six-nations-standings",
  keywords: [
    "six nations standings",
    "six nations table",
    "six nations fixtures",
    "six nations results",
    "six nations rugby standings",
  ],
});

export default function SixNationsStandingsPage() {
  return (
    <SeoLandingPage
      title="Six Nations Standings"
      description="Table, fixtures, results and current championship context."
      intro="RugbyNow tracks the Six Nations standings, match results, fixtures and title race context. Use this page to jump straight into the current Six Nations table and full competition coverage."
      bullets={[
        "Six Nations standings and table updates",
        "Results and fixtures from the current championship",
        "Competition page with rounds, teams and champions",
        "Fast access to one of the biggest international rugby tournaments",
      ]}
      primaryLink={{
        href: "/leagues/int-six-nations",
        label: "Open Six Nations standings",
        description: "Go to the full Six Nations competition page with standings, fixtures and results.",
      }}
      links={[
        {
          href: "/rugby-results",
          label: "Rugby results",
          description: "See current rugby results across all tracked competitions.",
        },
        {
          href: "/rugby-fixtures",
          label: "Rugby fixtures",
          description: "See upcoming rugby fixtures, including international matches.",
        },
        {
          href: "/leagues",
          label: "All leagues",
          description: "Browse more competitions tracked by RugbyNow.",
        },
      ]}
    />
  );
}
