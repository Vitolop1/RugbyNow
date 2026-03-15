import type { Metadata } from "next";
import { Suspense } from "react";
import HomeClient from "./HomeClient";
import LoadingScreen from "@/app/components/LoadingScreen";
import { buildStaticMetadata } from "@/lib/seo";

export const metadata: Metadata = buildStaticMetadata({
  title: "Rugby Results, Fixtures, Live Scores and Standings",
  description:
    "Follow rugby results, fixtures, live scores and standings across Six Nations, Super Rugby, URC, SVNS, Top 14 and more on RugbyNow.",
  path: "/",
  keywords: [
    "rugby results",
    "rugby fixtures",
    "rugby live scores",
    "rugby standings",
    "rugby matches today",
    "six nations results",
    "super rugby results",
  ],
});

export default async function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <HomeClient />
    </Suspense>
  );
}
