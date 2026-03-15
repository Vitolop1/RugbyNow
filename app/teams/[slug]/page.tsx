import type { Metadata } from "next";
import { buildTeamMetadata } from "@/lib/seo";
import TeamClient from "./TeamClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return buildTeamMetadata(slug);
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamClient slug={slug} />;
}
