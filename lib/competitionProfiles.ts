export type CompetitionProfile = {
  slug: string;
  country?: string;
  region?: string;
  founded?: string;
  currentChampion?: {
    name: string;
    slug?: string;
    seasonLabel?: string;
    note?: string;
  };
  summary: string;
  history: string;
};

const COMPETITION_PROFILES: Record<string, CompetitionProfile> = {
  "fr-top14": {
    slug: "fr-top14",
    country: "France",
    region: "Europe",
    founded: "1892",
    summary:
      "Top 14 es la primera division profesional del rugby frances y una de las ligas mas fuertes del hemisferio norte.",
    history:
      "Reune a 14 clubes de Francia y alimenta buena parte del calendario europeo junto con la Champions Cup. Su ecosistema mezcla tradicion historica, estadios grandes y una base profunda de formacion.",
  },
  "it-serie-a-elite": {
    slug: "it-serie-a-elite",
    country: "Italy",
    region: "Europe",
    founded: "1929",
    summary:
      "Serie A Elite es la maxima categoria domestica del rugby italiano y funciona como la vitrina principal para los clubes del pais.",
    history:
      "La liga italiana fue cambiando de formato a lo largo de las decadas, pero sigue siendo el eje del rugby de clubes en Italia y la base competitiva desde la que salen jugadores hacia el alto rendimiento europeo.",
  },
  "en-premiership-rugby": {
    slug: "en-premiership-rugby",
    country: "England",
    region: "Europe",
    founded: "1987",
    summary:
      "Premiership Rugby es la liga profesional de elite de Inglaterra y uno de los torneos de referencia del rugby europeo.",
    history:
      "Combina clubes historicos, academias fuertes y un calendario muy exigente. Su peso competitivo la mantiene conectada con la Champions Cup y con gran parte del desarrollo del rugby ingles.",
  },
  "int-united-rugby-championship": {
    slug: "int-united-rugby-championship",
    region: "Europe / South Africa",
    founded: "2001",
    summary:
      "United Rugby Championship es una liga multinacional que reune franquicias de Irlanda, Escocia, Gales, Italia y Sudafrica.",
    history:
      "Nacio como una estructura celta y fue ampliando su huella geografia con equipos italianos y luego sudafricanos. Hoy es una de las plataformas mas fuertes para el rugby profesional de clubes fuera de Francia e Inglaterra.",
  },
  "eu-champions-cup": {
    slug: "eu-champions-cup",
    region: "Europe",
    founded: "1995",
    summary:
      "European Rugby Champions Cup es la gran copa de clubes del hemisferio norte y enfrenta a los mejores equipos de las ligas europeas.",
    history:
      "Es el torneo que mide de manera directa a las potencias del Top 14, URC y Premiership. Su valor esta en el cruce internacional y en el peso historico que tiene ganar Europa.",
  },
  "int-six-nations": {
    slug: "int-six-nations",
    region: "International",
    founded: "1883",
    currentChampion: {
      name: "France",
      slug: "france",
      seasonLabel: "2026",
      note: "Champions after the final-round win over England.",
    },
    summary:
      "Six Nations es el campeonato anual mas tradicional del rugby europeo de selecciones entre Inglaterra, Francia, Irlanda, Italia, Escocia y Gales.",
    history:
      "Su linaje viene del Home Nations y del Five Nations. Sigue siendo una de las citas mas relevantes del calendario internacional por tradicion, audiencia y rivalidades historicas.",
  },
  "int-world-cup": {
    slug: "int-world-cup",
    region: "International",
    founded: "1987",
    summary:
      "Rugby World Cup es la principal cita global de selecciones y el torneo que marca los grandes ciclos del rugby union.",
    history:
      "Se disputa cada cuatro anos y concentra a las potencias tradicionales junto con seleccionados emergentes. Es el evento que define buena parte de la memoria deportiva del rugby internacional.",
  },
  "int-nations-championship": {
    slug: "int-nations-championship",
    region: "International",
    summary:
      "Nations Championship es una ventana internacional pensada para ordenar cruces de selecciones y dar contexto competitivo sostenido fuera del Mundial.",
    history:
      "En RugbyNow lo tratamos como un bloque internacional de seleccionados. Su rol es completar el mapa anual de test matches y competencias de naciones.",
  },
  "int-super-rugby-pacific": {
    slug: "int-super-rugby-pacific",
    region: "Australia / New Zealand / Pacific",
    founded: "1996",
    summary:
      "Super Rugby Pacific es el torneo de franquicias del Pacifico sur y uno de los campeonatos mas veloces y espectaculares del calendario.",
    history:
      "Desciende del ecosistema Super Rugby y hoy conecta equipos de Australia, Nueva Zelanda y el Pacifico. Tiene enorme peso en la produccion de talento para los seleccionados del hemisferio sur.",
  },
  sra: {
    slug: "sra",
    region: "South America",
    founded: "2020",
    summary:
      "Super Rugby Americas es la liga profesional regional que articula el crecimiento del rugby de alto rendimiento en Sudamerica.",
    history:
      "Une franquicias de Argentina, Uruguay, Chile, Paraguay y Brasil. Para RugbyNow es una competencia central porque ordena buena parte del calendario profesional sudamericano actual.",
  },
  "ar-urba-top14": {
    slug: "ar-urba-top14",
    country: "Argentina",
    region: "Buenos Aires",
    summary:
      "URBA Top 14 es la maxima categoria de clubes de la Union de Rugby de Buenos Aires y una referencia historica del rugby argentino.",
    history:
      "Es el escenario donde compiten varios de los clubes mas tradicionales del pais. Su peso cultural e institucional excede a Buenos Aires y marca buena parte del pulso del rugby amateur de elite en Argentina.",
  },
  "ar-liga-norte-grande": {
    slug: "ar-liga-norte-grande",
    country: "Argentina",
    region: "Northwest Argentina",
    summary:
      "Liga Norte Grande agrupa a clubes del NOA y del norte argentino en una competencia regional con fuerte raiz local.",
    history:
      "En RugbyNow la seguimos como una liga clave para reflejar el movimiento de clubes del interior. Su valor esta en la identidad regional, los viajes cortos entre plazas historicas y la rivalidad entre Salta y Santiago del Estero.",
  },
  "us-mlr": {
    slug: "us-mlr",
    country: "United States",
    region: "North America",
    founded: "2018",
    summary:
      "Major League Rugby es la competencia profesional de referencia del rugby union en Estados Unidos.",
    history:
      "La liga busca consolidar estructuras profesionales, academias y presencia nacional en un mercado deportivo muy competitivo. Su crecimiento es central para la expansion del rugby en Norteamerica.",
  },
  "svns-australia": {
    slug: "svns-australia",
    region: "World Rugby Sevens",
    summary:
      "SVNS Australia es una parada del circuito mundial de rugby seven de World Rugby.",
    history:
      "Funciona como una etapa del calendario internacional de seven, con cuadros masculinos y femeninos, puntos para la tabla global y un perfil muy marcado de festival de juego corto.",
  },
  "svns-usa": {
    slug: "svns-usa",
    region: "World Rugby Sevens",
    summary:
      "SVNS USA es la fecha norteamericana del circuito mundial de rugby seven.",
    history:
      "La etapa estadounidense conecta el seven internacional con un mercado clave para la expansion global del deporte y mantiene visibilidad tanto para selecciones tradicionales como emergentes.",
  },
  "svns-hong-kong": {
    slug: "svns-hong-kong",
    region: "World Rugby Sevens",
    summary:
      "SVNS Hong Kong es una de las etapas mas iconicas del circuito mundial de rugby seven.",
    history:
      "Hong Kong tiene un peso historico enorme dentro del seven moderno. Para muchas selecciones, rendir bien en esta escala es casi una marca cultural ademas de deportiva.",
  },
  "svns-singapore": {
    slug: "svns-singapore",
    region: "World Rugby Sevens",
    summary:
      "SVNS Singapore es la parada del circuito mundial de seven en el sudeste asiatico.",
    history:
      "Aporta presencia del circuito en Asia y suele funcionar como una fecha clave en el cierre de la temporada regular del calendario de seven.",
  },
};

export function getCompetitionProfile(
  slug: string,
  fallback?: Partial<Pick<CompetitionProfile, "country" | "region">> & { name?: string | null }
) {
  const direct = COMPETITION_PROFILES[slug];
  if (direct) return direct;

  const displayName = fallback?.name ?? slug;
  return {
    slug,
    country: fallback?.country,
    region: fallback?.region,
    summary: `${displayName} forma parte del mapa competitivo que sigue RugbyNow.`,
    history:
      "Esta ficha de competencia se va completando con contexto historico, formato del torneo y detalles de la region donde se juega.",
  };
}
