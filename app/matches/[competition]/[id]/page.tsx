import type { Metadata } from "next";
import MatchClient from "@/app/matches/[competition]/[id]/MatchClient";
import { buildStaticMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competition: string; id: string }>;
}): Promise<Metadata> {
  const { competition, id } = await params;

  return buildStaticMetadata({
    title: "Rugby Match Details, Score and League Context",
    description:
      "Follow rugby match details with score, kickoff, venue, standings context and team positions on RugbyNow.",
    path: `/matches/${competition}/${id}`,
    keywords: [
      "rugby match",
      "rugby match details",
      "rugby score",
      "rugby venue",
      "rugby kickoff time",
    ],
  });
}

export default function MatchPage() {
  return <MatchClient />;
}
