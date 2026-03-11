import TeamClient from "./TeamClient";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TeamClient slug={slug} />;
}
