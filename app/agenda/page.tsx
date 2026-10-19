import { buildStaticMetadata } from "@/lib/seo";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";
import { EDITORIAL_AGENDA } from "@/data/rugbyAgenda";
import AgendaClient from "./AgendaClient";

export const dynamic = "force-dynamic";
export const metadata = buildStaticMetadata({ title: "Rugby TV Guide, Weekly Fixtures and Where to Watch", description: "Find rugby matches, regional fixtures, TV, streaming and radio programmes in one searchable weekly agenda. Save events and add them to your calendar.", path: "/agenda" });

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ date?: string; event?: string }> }) {
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && !Number.isNaN(Date.parse(params.date))
    ? params.date : getISODateInTimeZone(new Date(), "America/Argentina/Buenos_Aires");
  const eventId = EDITORIAL_AGENDA.find((event) => event.id === params.event)?.id;
  return <AgendaClient initialDate={date} initialEventId={eventId} />;
}
