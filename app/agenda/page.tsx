import { buildStaticMetadata } from "@/lib/seo";
import AgendaPageView from "./AgendaPageView";

export const dynamic = "force-dynamic";
// /agenda remains a usable alias; the full daily agenda's canonical is home.
export const metadata = buildStaticMetadata({title:"Agenda de rugby: partidos, resultados y TV",description:"Consultá la agenda de rugby por día, competición y país de transmisión. Guardá tus partidos y agregalos al calendario.",path:"/"});
export default AgendaPageView;
