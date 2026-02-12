// app/leagues/[slug]/page.tsx

import LeagueClient from "./LeagueClient";

export default function Page({ params }: { params: { slug: string } }) {
  return <LeagueClient slug={params.slug} />;
}
