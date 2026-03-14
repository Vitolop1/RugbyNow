export type CountryProfile = {
  key: string;
  name: string;
  summary: string;
  rugbyContext: string;
};

const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  argentina: {
    key: "argentina",
    name: "Argentina",
    summary: "Argentina es uno de los polos mas fuertes del rugby en Sudamerica, con una tradicion muy marcada en clubes y seleccionados.",
    rugbyContext: "Los Pumas empujaron la visibilidad internacional, mientras que Buenos Aires, Cordoba, Tucuman, Salta y Santiago del Estero sostienen una cultura de clubes muy profunda.",
  },
  uruguay: {
    key: "uruguay",
    name: "Uruguay",
    summary: "Uruguay mantiene una estructura de rugby estable y competitiva dentro de Sudamerica.",
    rugbyContext: "El crecimiento de su seleccionado y de proyectos como Penarol Rugby consolidaron al pais como una referencia regional en el profesionalismo.",
  },
  chile: {
    key: "chile",
    name: "Chile",
    summary: "Chile viene de un ciclo de crecimiento fuerte en rugby de seleccion y de franquicia.",
    rugbyContext: "La clasificacion mundialista y la aparicion de Selknam aceleraron el salto competitivo del rugby chileno.",
  },
  brazil: {
    key: "brazil",
    name: "Brazil",
    summary: "Brasil sigue ampliando su base de rugby con foco en desarrollo regional y competencia internacional.",
    rugbyContext: "El trabajo de franquicias sudamericanas y de torneos regionales ayuda a sostener el crecimiento del juego en un mercado enorme.",
  },
  paraguay: {
    key: "paraguay",
    name: "Paraguay",
    summary: "Paraguay aparece cada vez con mas presencia dentro del mapa sudamericano del rugby.",
    rugbyContext: "La estructura profesional regional le dio mas roce internacional y mayor continuidad competitiva al ecosistema paraguayo.",
  },
  france: {
    key: "france",
    name: "France",
    summary: "Francia es una potencia estructural del rugby mundial tanto por seleccion como por densidad de clubes.",
    rugbyContext: "Top 14 y Pro D2 sostienen una maquinaria profesional enorme, y el rugby frances tiene peso deportivo, financiero y cultural en toda Europa.",
  },
  italy: {
    key: "italy",
    name: "Italy",
    summary: "Italia combina liga domestica, presencia en el Seis Naciones y franquicias en torneos multinacionales.",
    rugbyContext: "Su crecimiento pasa por reforzar bases juveniles, Serie A Elite y la integracion con competencias europeas de mayor nivel.",
  },
  england: {
    key: "england",
    name: "England",
    summary: "Inglaterra es una de las cunas del rugby union y conserva una estructura historica enorme.",
    rugbyContext: "La Premiership, el sistema de academias y el peso de Twickenham mantienen al rugby ingles entre los centros mas influyentes del deporte.",
  },
  ireland: {
    key: "ireland",
    name: "Ireland",
    summary: "Irlanda construyo uno de los modelos mas eficientes del rugby moderno.",
    rugbyContext: "Sus provincias compiten arriba en Europa y el seleccionado transformo esa base en un ciclo sostenido de alto rendimiento internacional.",
  },
  scotland: {
    key: "scotland",
    name: "Scotland",
    summary: "Escocia tiene una tradicion fundacional en el rugby internacional y un calendario muy ligado al Seis Naciones.",
    rugbyContext: "Aunque su estructura profesional es mas compacta, sigue siendo una referencia central del rugby del hemisferio norte.",
  },
  wales: {
    key: "wales",
    name: "Wales",
    summary: "Gales vive el rugby como una senal fuerte de identidad deportiva y cultural.",
    rugbyContext: "El seleccionado y las regiones del URC sostienen un ecosistema con enorme carga historica y emocional en el calendario europeo.",
  },
  "south africa": {
    key: "south africa",
    name: "South Africa",
    summary: "Sudafrica es una superpotencia del rugby union y uno de los paises mas determinantes de la era moderna.",
    rugbyContext: "Su profundidad de jugadores, sus franquicias profesionales y el historial de los Springboks la convierten en referencia global.",
  },
  "united states": {
    key: "united states",
    name: "United States",
    summary: "Estados Unidos es un mercado de crecimiento para el rugby, con foco en profesionalizacion y expansion de audiencia.",
    rugbyContext: "Major League Rugby, los eventos de seven y el horizonte de grandes torneos empujan el desarrollo del deporte en Norteamerica.",
  },
  australia: {
    key: "australia",
    name: "Australia",
    summary: "Australia es una plaza historica del rugby del hemisferio sur y una de las bases originales del Super Rugby.",
    rugbyContext: "Sus franquicias siguen siendo claves para la formacion de Wallabies y para el calendario profesional del Pacifico.",
  },
  "new zealand": {
    key: "new zealand",
    name: "New Zealand",
    summary: "Nueva Zelanda es una referencia absoluta del rugby mundial por cultura, formacion y resultados.",
    rugbyContext: "El peso de los All Blacks y de sus franquicias hace que casi cualquier competencia con presencia neozelandesa tenga una vara competitiva altisima.",
  },
  fiji: {
    key: "fiji",
    name: "Fiji",
    summary: "Fiji combina talento historico en rugby union y un prestigio enorme en seven.",
    rugbyContext: "El pais tiene una identidad de juego muy reconocible y sigue siendo una usina de jugadores para torneos internacionales y clubes del exterior.",
  },
  samoa: {
    key: "samoa",
    name: "Samoa",
    summary: "Samoa conserva una tradicion muy fuerte dentro del rugby del Pacifico.",
    rugbyContext: "Su peso historico excede el tamano del pais y aparece tanto en el rugby de quince como en el seven.",
  },
  tonga: {
    key: "tonga",
    name: "Tonga",
    summary: "Tonga forma parte del nucleo historico del rugby del Pacifico.",
    rugbyContext: "La fuerza fisica de sus seleccionados y la exportacion de talento sostienen su presencia en el mapa global del rugby.",
  },
  japan: {
    key: "japan",
    name: "Japan",
    summary: "Japon es uno de los proyectos de crecimiento mas fuertes del rugby en Asia.",
    rugbyContext: "Su liga domestica, su Mundial 2019 y la mejora del seleccionado empujaron al pais a un lugar mucho mas visible dentro del juego internacional.",
  },
  georgia: {
    key: "georgia",
    name: "Georgia",
    summary: "Georgia es una nacion emergente con enorme identidad en forwards y scrum.",
    rugbyContext: "Su ascenso competitivo la volvio una presencia habitual en debates sobre expansion del calendario internacional europeo.",
  },
  romania: {
    key: "romania",
    name: "Romania",
    summary: "Rumania tiene una tradicion larga dentro del rugby europeo fuera del bloque del Seis Naciones.",
    rugbyContext: "Su historia internacional le da peso especifico en las conversaciones sobre el segundo nivel europeo de selecciones.",
  },
  portugal: {
    key: "portugal",
    name: "Portugal",
    summary: "Portugal viene sumando visibilidad gracias a un rugby cada vez mas competitivo y ordenado.",
    rugbyContext: "Los Lobos representan el crecimiento de los seleccionados emergentes europeos con una propuesta dinamica y cada vez mas estable.",
  },
  spain: {
    key: "spain",
    name: "Spain",
    summary: "Espana empuja su desarrollo de rugby entre estructura domestica, seleccion y circuito de seven.",
    rugbyContext: "Es una plaza importante para el crecimiento europeo fuera del nucleo tradicional del Seis Naciones.",
  },
  canada: {
    key: "canada",
    name: "Canada",
    summary: "Canada mantiene presencia historica en el rugby norteamericano y en el circuito de selecciones.",
    rugbyContext: "Aunque su ciclo internacional tuvo altibajos, sigue siendo una referencia necesaria para entender el rugby en el continente.",
  },
  belgium: {
    key: "belgium",
    name: "Belgium",
    summary: "Belgica forma parte del grupo de paises europeos que buscan consolidarse en el segundo nivel internacional.",
    rugbyContext: "Su lugar en RugbyNow ayuda a completar el panorama de naciones con actividad competitiva fuera del eje principal del Seis Naciones.",
  },
  namibia: {
    key: "namibia",
    name: "Namibia",
    summary: "Namibia es una de las referencias mas estables del rugby africano fuera de Sudafrica.",
    rugbyContext: "Su continuidad mundialista le dio una presencia regular en los grandes torneos de selecciones.",
  },
  zimbabwe: {
    key: "zimbabwe",
    name: "Zimbabwe",
    summary: "Zimbabwe tiene una historia rugbistica profunda en Africa austral.",
    rugbyContext: "Su recorrido internacional y su capacidad de producir jugadores la mantienen dentro del radar del rugby de naciones emergentes.",
  },
  "hong kong": {
    key: "hong kong",
    name: "Hong Kong",
    summary: "Hong Kong ocupa un lugar especial en el calendario global del rugby seven.",
    rugbyContext: "La etapa hongkonesa del circuito mundial es una referencia historica y le da al territorio una visibilidad muy superior a su tamano deportivo.",
  },
  kenya: {
    key: "kenya",
    name: "Kenya",
    summary: "Kenia es una nacion muy reconocida dentro del rugby seven mundial.",
    rugbyContext: "Su velocidad y su impacto en el circuito de seven le dieron identidad propia en el calendario internacional.",
  },
  "great britain": {
    key: "great britain",
    name: "Great Britain",
    summary: "Gran Bretana aparece sobre todo en el circuito de seven como una identidad competitiva compartida.",
    rugbyContext: "Su presencia sintetiza talento de un bloque historico del rugby y ayuda a ordenar ciertas etapas del calendario internacional de seven.",
  },
  europe: {
    key: "europe",
    name: "Europe",
    summary: "Europa concentra varias de las ligas y copas mas fuertes del rugby union.",
    rugbyContext: "La convivencia entre torneos domesticos potentes y competiciones continentales hace del continente una de las zonas mas densas del calendario global.",
  },
  international: {
    key: "international",
    name: "International Rugby",
    summary: "El calendario internacional organiza las ventanas, giras y torneos de selecciones que marcan el ritmo global del rugby.",
    rugbyContext: "Mundiales, campeonatos anuales y test matches son la capa que conecta identidades nacionales, ranking y grandes rivalidades historicas.",
  },
  world: {
    key: "world",
    name: "World Rugby",
    summary: "La capa global del rugby reune torneos, circuitos y selecciones de distintos continentes en una misma agenda.",
    rugbyContext: "En RugbyNow usamos esta categoria para seguir competencias itinerantes y eventos que no pertenecen a una sola geografia competitiva.",
  },
};

export function getCountryProfile(country?: string | null) {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  const direct = COUNTRY_PROFILES[key];
  if (direct) return direct;

  return {
    key,
    name: country,
    summary: `${country} forma parte del mapa internacional que sigue RugbyNow.`,
    rugbyContext:
      "Esta ficha de pais o region se va completando con contexto sobre seleccionados, ligas locales y presencia en el calendario global.",
  };
}
