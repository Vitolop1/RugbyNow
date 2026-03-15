import type { Metadata } from "next";
import SeoLandingPage from "@/app/components/SeoLandingPage";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Rugby Matches Today, Fixtures and Results",
  description:
    "Check rugby matches today, upcoming fixtures, results and standings from major rugby competitions on RugbyNow.",
  path: "/rugby-matches",
  keywords: [
    "rugby matches",
    "rugby matches today",
    "today rugby matches",
    "rugby fixtures and results",
    "rugby schedule today",
  ],
});

export default function RugbyMatchesPage() {
  return (
    <SeoLandingPage
      title="Rugby Matches Today"
      description="Today’s rugby matches, fixtures, results and competition links."
      intro="This page helps searchers land on RugbyNow when looking for rugby matches today. From here you can jump into live scores, upcoming fixtures, standings and league pages for the major competitions RugbyNow follows."
      bullets={[
        "Today’s rugby matches across key leagues and tournaments",
        "Fast links to live scores, final results and standings",
        "Timezone-aware schedule and kickoff display",
        "Useful starting point for following rugby every day",
      ]}
      primaryLink={{
        href: "/",
        label: "See today’s matches",
        description: "Open RugbyNow home for the current day’s rugby matches, live games and scores.",
      }}
      links={[
        {
          href: "/rugby-fixtures",
          label: "Rugby fixtures",
          description: "Browse upcoming rugby fixtures and schedules.",
        },
        {
          href: "/rugby-results",
          label: "Rugby results",
          description: "See completed match scores and latest rugby results.",
        },
        {
          href: "/leagues",
          label: "All rugby competitions",
          description: "Go to the full competition directory and choose a league to follow.",
        },
      ]}
    />
  );
}
