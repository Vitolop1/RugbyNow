import type { Metadata } from "next";
import SeoLandingPage from "@/app/components/SeoLandingPage";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Rugby Live Scores and Match Status",
  description:
    "Follow rugby live scores, match status, full time updates and current fixtures on RugbyNow.",
  path: "/rugby-live-scores",
  keywords: [
    "rugby live scores",
    "live rugby scores",
    "rugby live results",
    "rugby live match",
    "rugby score today",
  ],
});

export default function RugbyLiveScoresPage() {
  return (
    <SeoLandingPage
      title="Rugby Live Scores"
      description="Current match state, live score updates and full time coverage."
      intro="RugbyNow is built to follow rugby live scores with clear match status, full time updates, upcoming kickoffs and league context. Use this page as a search-friendly entry point when looking for live rugby scores and today’s matches."
      bullets={[
        "Live rugby scores and current match state",
        "Clear status labels for live, half time and full time",
        "Fast access to league pages and standings",
        "Coverage built for mobile score checking",
      ]}
      primaryLink={{
        href: "/",
        label: "Open live rugby coverage",
        description: "Head to the main page to see live matches, final scores and today’s schedule.",
      }}
      links={[
        {
          href: "/rugby-results",
          label: "Rugby results",
          description: "See final rugby results and completed match scores.",
        },
        {
          href: "/leagues/int-six-nations",
          label: "Six Nations live scores",
          description: "Open the Six Nations page for standings, fixtures and match coverage.",
        },
        {
          href: "/leagues/int-super-rugby-pacific",
          label: "Super Rugby live scores",
          description: "Open Super Rugby Pacific coverage with results, fixtures and standings.",
        },
      ]}
    />
  );
}
