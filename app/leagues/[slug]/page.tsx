import type { Metadata } from "next";
import { buildLeagueMetadata } from "@/lib/seo";
import LeagueClient from "./LeagueClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildLeagueMetadata(slug);
}

export default function Page() {
  return <LeagueClient />;
}
