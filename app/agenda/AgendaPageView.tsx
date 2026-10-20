import { isAgendaDate } from "@/lib/dailyAgenda";
import { loadDailyAgenda } from "@/lib/dailyAgendaServer";
import { getISODateInTimeZone } from "@/lib/timeZoneDate";
import { DEFAULT_TZ } from "@/lib/timeZones";
import DailyAgendaClient from "./DailyAgendaClient";

export default async function AgendaPageView({searchParams}:{searchParams:Promise<{date?:string;event?:string}>}) {
  const params = await searchParams;
  const explicitDate = isAgendaDate(params.date);
  const date = explicitDate ? params.date! : getISODateInTimeZone(new Date(),DEFAULT_TZ);
  const initialData = await loadDailyAgenda(date);
  return <DailyAgendaClient key={`${date}:${params.event || ""}`} initialData={initialData} initialDate={date} explicitDate={explicitDate} initialEventId={params.event}/>;
}
