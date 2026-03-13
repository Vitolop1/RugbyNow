import WatchClient from "./WatchClient";

export default async function WatchPage({
  searchParams,
}: {
  searchParams?: Promise<{
    competitionSlug?: string;
    competitionName?: string;
    home?: string;
    away?: string;
  }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;

  return (
    <WatchClient
      competitionSlug={resolved?.competitionSlug}
      competitionName={resolved?.competitionName}
      home={resolved?.home}
      away={resolved?.away}
    />
  );
}
