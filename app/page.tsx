import { buildStaticMetadata } from "@/lib/seo";
import AgendaPageView from "./agenda/AgendaPageView";

// Dates must be evaluated per request, not frozen into the deployment's HTML.
export const dynamic = "force-dynamic";

export const metadata = buildStaticMetadata({title:"Rugby hoy: partidos, horarios, resultados y dónde verlos",description:"La agenda de rugby de hoy: horarios en tu zona, resultados y opciones de TV por país. Los Pumas, URBA y las principales competiciones internacionales.",path:"/",keywords:["rugby hoy","partidos de rugby hoy","dónde ver rugby","URBA resultados","rugby fixtures","rugby today"]});
export default AgendaPageView;
