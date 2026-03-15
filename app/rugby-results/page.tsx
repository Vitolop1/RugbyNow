import type { Metadata } from "next";
import SeoLandingPage from "@/app/components/SeoLandingPage";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Rugby Results Today, Scores and Final Results",
  description:
    "Rugby results today, live scores, final results and competition coverage from Six Nations, Super Rugby, URC, SVNS and more on RugbyNow.",
  path: "/rugby-results",
  keywords: [
    "rugby results",
    "rugby scores",
    "rugby final results",
    "rugby results today",
    "super rugby results",
  ],
});

export default function RugbyResultsPage() {
  return (
    <SeoLandingPage
      title="Rugby Results Today"
      description="Live scores, final results and updated rugby coverage."
      intro="RugbyNow tracks rugby results, live scores and final scores across club and international competitions. Use this page as a fast entry point for current rugby results and follow major leagues and national team tournaments."
      bullets={[
        "Live rugby scores and final results",
        "Coverage for Six Nations, Super Rugby, URC, SVNS and regional leagues",
        "Quick access to standings, fixtures and team pages",
        "Mobile-friendly pages built to check scores fast",
      ]}
      primaryLink={{
        href: "/",
        label: "Open today’s rugby results",
        description: "Go straight to the main RugbyNow home to see today’s scores, live matches and upcoming kickoffs.",
      }}
      links={[
        {
          href: "/leagues/int-six-nations",
          label: "Six Nations results",
          description: "Check Six Nations scores, standings and fixtures on the competition page.",
        },
        {
          href: "/leagues/int-super-rugby-pacific",
          label: "Super Rugby results",
          description: "Follow Super Rugby Pacific results, tables and current round matches.",
        },
        {
          href: "/rugby-live-scores",
          label: "Rugby live scores",
          description: "See live rugby score coverage and current match states from RugbyNow.",
        },
      ]}
    />
  );
}
