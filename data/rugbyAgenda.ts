import type { AgendaEvent, AgendaProvider, AgendaRegion } from "../lib/agenda";

// A bounded editorial sample from the user-provided 15–22 October guide.
// These dates never roll forward. Provider names are not proof of a live stream.
export const AGENDA_SOURCE = {
  name: "Norte Rugby · Horacio Cortez",
  date: "2026-10-15",
  from: "2026-10-15",
  to: "2026-10-22",
  timeZone: "America/Argentina/Buenos_Aires",
};

const disney: AgendaProvider = { id: "disney-plus", name: "Disney+", href: "https://www.disneyplus.com/", linkType: "platform" };
const tryTV: AgendaProvider = { id: "try-tv-tucuman", name: "Try TV Tucumán", href: "https://www.youtube.com/channel/UCSbw1LvjkErbu62IEP9c2cQ", linkType: "channel" };
// Channel identities verified from the publishers; these are not event/live URLs.
const programmeChannels:Record<string,string>={
  "Somos La Plata · Flow":"https://www.youtube.com/channel/UC294dkvc88KFZkkHsBLMAFQ",
  "Mía Tucumán HD":"https://www.youtube.com/@miatucumanhd",
  "LaRzRadio":"https://www.youtube.com/channel/UCYhdNotH35a31FoptmQj3Tg",
};
const provider = (name: string): AgendaProvider => ({ ...(programmeChannels[name]?{href:programmeChannels[name],linkType:"channel" as const}:{}), id: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"), name });

function event(day: number, time: string, kind: AgendaEvent["kind"], region: AgendaRegion, title: string, competition: string, providers: AgendaProvider[], transmissionPending = false): AgendaEvent {
  const date = `2026-10-${String(day).padStart(2, "0")}`;
  const id = `${date}-${time.replace(":", "")}-${title}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
  return { id, title, competition, kind, region, startsAt: new Date(`${date}T${time}:00-03:00`).toISOString(), providers, source: AGENDA_SOURCE.name, sourceDate: AGENDA_SOURCE.date, transmissionPending };
}
const match = (day: number, time: string, region: AgendaRegion, title: string, competition: string, broadcasters: AgendaProvider[], pending = false) => event(day, time, "match", region, title, competition, broadcasters, pending);
const show = (day: number, time: string, title: string, description: string, broadcaster: AgendaProvider) => event(day, time, "show", "argentina", title, description, [broadcaster]);

export const EDITORIAL_AGENDA: AgendaEvent[] = [
  match(16, "03:05", "international", "Northland vs Otago", "National Provincial Championship · Semifinal", [disney]),
  match(17, "01:30", "international", "Australia vs Nueva Zelanda", "Bledisloe Cup · Test match", [disney]),
  match(17, "10:00", "international", "Hong Kong China M-19 vs Namibia M-19", "World Rugby · Juveniles", [disney]),
  match(17, "12:50", "international", "Brasil M-20 vs Canadá M-20", "World Rugby · Juveniles", [disney]),
  match(17, "15:30", "international", "Lobos Rugby Club vs Los Cuervos Rugby", "Campeonato Uruguayo de Rugby", [disney]),
  match(17, "18:50", "international", "Chile M-20 vs Bélgica M-20", "World Rugby · Juveniles", [disney]),
  match(17, "23:00", "international", "Canterbury vs Taranaki", "National Provincial Championship · Semifinal", [disney]),
  ...["SIC vs Buenos Aires C&RC", "Newman vs CUBA", "Alumni vs CASI", "Champagnat vs Los Tilos", "Hindú vs Atlético del Rosario", "La Plata vs Regatas", "Belgrano Athletic vs Los Matreros"].map((title) => match(17, "15:30", "buenos-aires", title, "URBA Top 14 · Fecha 26", [disney])),
  match(17, "15:30", "buenos-aires", "San Andrés vs Lomas", "URBA Primera A · Fecha 25", [provider("Club San Andrés")]),
  match(17, "15:30", "buenos-aires", "Universitario La Plata vs Curupaytí", "URBA Primera A · Fecha 25", [provider("Rugby Culp")]),
  match(17, "15:30", "buenos-aires", "Pueyrredón vs San Luis", "URBA Primera A · Fecha 25", [provider("Pueyrredón Streaming")]),
  match(17, "16:15", "argentina", "Jockey Salta vs Huirapuca", "Regional NOA A · Fecha 7", [provider("Tercer Tiempo TV")]),
  match(17, "16:30", "argentina", "Universitario vs Natación", "Regional NOA A · Fecha 7", [tryTV]),
  match(17, "16:30", "argentina", "Alfiles vs Jockey San Juan", "Regional Cuyo Plata · Fecha 14", [provider("Ovalados"), provider("Desde el Touch")]),
  match(17, "16:00", "argentina", "Córdoba M-17 vs Uruguay M-17", "Argentino Juvenil · Fecha 3", [provider("Unión Cordobesa Rugby")], true),
  match(17, "12:00", "argentina", "Salta M-17 vs Cuyo M-17", "Argentino Juvenil · Fecha 3", [provider("Tercer Tiempo TV")], true),
  match(17, "19:15", "argentina", "Tala RC vs Córdoba Athletic", "Regional Córdoba Top 10 · Fecha 17", [provider("DIRECTV Sport")]),
  match(18, "16:00", "argentina", "Cardenales RC vs Tucumán Rugby", "Regional NOA A · Fecha 7", [provider("DIRECTV Sport")]),
  show(19, "10:00", "Todos al In-goal", "Reírse y aprender · Periodismo Rugby", provider("losprimosclubTV")),
  show(19, "16:00", "De Rugby Somos", "Rugby de la ciudad de La Plata", provider("De Rugby Somos")),
  show(19, "16:30", "XDXT PLAY", "Córdoba XV", provider("XDXT Play")),
  show(19, "17:40", "Juego de Pasiones", "Rugby local, nacional e internacional · Rosario", { id: "lt8", name: "Radio LT8 AM 830", href: "https://www.lt8.com.ar/", linkType: "channel" }),
  show(19, "18:00", "Bonus Rugby", "Todo el rugby sanjuanino", provider("Masmedios San Juan")),
  show(19, "19:00", "La Ovalada", "NEA · Chaco, Corrientes, Misiones, Formosa y Paraguay", provider("Datachaco streaming")),
  show(19, "21:00", "Equipo Scrum", "Programa de rugby", disney),
  show(20, "17:00", "Rugby Platense", "Rugby local, nacional e internacional", provider("Somos La Plata · Flow")),
  show(20, "21:00", "Try TV Tucumán", "Todo el Regional NOA y más", tryTV),
  show(20, "22:00", "Rugby Tucumano · 19ª temporada", "Pasión, equipo y corazón", provider("Mía Tucumán HD")),
  show(20, "22:00", "22 Yardas Rugby", "Rugby de Buenos Aires, nacional e internacional", provider("LaRzRadio")),
  show(20, "23:00", "Somos Salta 3er Tiempo", "Programa de rugby", provider("Cablevisión · Personal Flow")),
  show(21, "12:30", "Tercer Tiempo Rugby", "Radio, YouTube y web · Entre Ríos", provider("Vorterix Litoral")),
  show(21, "14:00", "La Tribuna", "Rugby de Jujuy · Con el Pato Espinassi", provider("Radio La Red FM 89.7 Jujuy")),
  show(21, "15:00", "Programa DDT", "Después del Try · Rosario", provider("DDT Rosario")),
  show(21, "17:40", "SportMusic", "Rugby local, nacional e internacional", provider("SportMusic")),
  show(21, "19:00", "Mate y Rugby c/Fran Altamirano", "El rugby de Córdoba", provider("Fran Altamirano · Radio Pobre Johnny 88.9")),
  show(21, "19:00", "La Ovalada", "NEA · Resistencia", provider("Radio 104.7 de Resistencia")),
  show(21, "19:00", "Rugby Report TV", "Rugby de Bahía Blanca", provider("Rugby Report")),
  show(21, "19:00", "Rompiendo Guindas", "La voz del rugby patagónico · Desde 1997", provider("Rompiendo Guindas")),
  show(21, "19:30", "Desde el Touch", "Primero el rugby de San Juan", provider("Desde el Touch")),
  show(21, "20:00", "Highlights · Top 14 de Francia", "Resumen semanal 2026–2027", disney),
  show(21, "20:30", "Pasión & Deporte · El Stream", "Rugby de Santiago del Estero", provider("pasionydeporte")),
  show(21, "21:00", "Rugby Catamarca TV", "El rugby de la Unión Andina", provider("Canal 10 TVEO Catamarca")),
  show(21, "22:00", "Rugby BreakDown", "El rugby en el foco local y del NEA", provider("Rugby BreakStream")),
  show(21, "22:15", "Rugby Champagne con Ovalados", "Noticias, información y resultados de Cuyo", provider("FM 94.1 San Juan · Rugby Champagne")),
  show(22, "18:00", "Bonus Rugby", "Todo el rugby sanjuanino", provider("Masmedios San Juan")),
  show(22, "20:00", "Scrum 5 Radio", "30 años de pasión por el rugby · Tucumán", provider("Scrum 5 Radio")),
];
