import type { Metadata } from "next";
import WeeklyClient from "@/app/weekly/WeeklyClient";
import { readWeeklyDigest } from "@/lib/weeklyDigest";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Weekly Rugby Recaps and Highlights",
  description:
    "Read weekly rugby recaps, standout matches, results context and featured stories from RugbyNow.",
  path: "/weekly",
  keywords: [
    "weekly rugby recap",
    "rugby weekly roundup",
    "rugby highlights",
    "rugby stories",
  ],
});

export default function WeeklyPage() {
  const digest = readWeeklyDigest();
  return <WeeklyClient digest={digest} />;
}
