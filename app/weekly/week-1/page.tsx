import type { Metadata } from "next";
import Week1Client from "@/app/weekly/week-1/Week1Client";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Weekly Rugby Recap Week 1",
  description:
    "Read RugbyNow's Week 1 rugby recap with standout results, storylines and weekly context.",
  path: "/weekly/week-1",
  keywords: [
    "weekly rugby recap",
    "rugby week 1 recap",
    "rugby results recap",
  ],
});

export default function Week1Post() {
  return <Week1Client />;
}
