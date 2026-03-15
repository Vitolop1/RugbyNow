import type { Metadata } from "next";
import SeoLandingPage from "@/app/components/SeoLandingPage";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Rugby Fixtures, Schedule and Upcoming Matches",
  description:
    "Find rugby fixtures, schedules and upcoming matches across Six Nations, Super Rugby, URC, SVNS and more on RugbyNow.",
  path: "/rugby-fixtures",
  keywords: [
    "rugby fixtures",
    "rugby schedule",
    "upcoming rugby matches",
    "rugby matches today",
    "rugby fixtures today",
  ],
});

export default function RugbyFixturesPage() {
  return (
    <SeoLandingPage
      title="Rugby Fixtures and Schedule"
      description="Upcoming rugby matches with local time and competition context."
      intro="RugbyNow helps you check upcoming rugby fixtures, kickoff times and current competition schedules across international tournaments and club leagues. Fixtures are shown with timezone support so the schedule is easier to follow wherever you are."
      bullets={[
        "Upcoming rugby fixtures by date",
        "Kickoff times shown in the viewer’s timezone",
        "Club and international rugby schedule coverage",
        "Competition pages with round-by-round fixtures",
      ]}
      primaryLink={{
        href: "/",
        label: "Open today’s fixtures",
        description: "See today’s fixtures, upcoming matches and live coverage from the home page.",
      }}
      links={[
        {
          href: "/leagues",
          label: "Browse all competitions",
          description: "Open the full list of leagues and tournaments tracked by RugbyNow.",
        },
        {
          href: "/leagues/int-super-rugby-pacific",
          label: "Super Rugby fixtures",
          description: "Check the latest Super Rugby Pacific fixtures, results and standings.",
        },
        {
          href: "/leagues/int-six-nations",
          label: "Six Nations fixtures",
          description: "Follow the Six Nations match schedule, standings and current round.",
        },
      ]}
    />
  );
}
