export type TeamProfile = {
  slug: string;
  displayName?: string;
  country?: string;
  city?: string;
  venue?: string;
  founded?: string;
  summary?: string;
  history?: string;
  colors?: string[];
};

const TEAM_PROFILES: Record<string, TeamProfile> = {
  "pampas-xv": {
    slug: "pampas-xv",
    displayName: "Pampas XV",
    country: "Argentina",
    city: "Buenos Aires",
    venue: "Buenos Aires",
    founded: "2020s",
    summary: "Franquicia argentina de Super Rugby Americas con base en Buenos Aires.",
    history: "Pampas forma parte del ecosistema de alto rendimiento del rugby argentino y compite en el circuito profesional sudamericano.",
    colors: ["Celeste", "Blanco"],
  },
  "dogos-xv": {
    slug: "dogos-xv",
    displayName: "Dogos XV",
    country: "Argentina",
    city: "Cordoba",
    venue: "Cordoba",
    founded: "2020s",
    summary: "Franquicia profesional cordobesa que representa a una de las regiones mas fuertes del rugby argentino.",
    history: "Dogos XV compite en Super Rugby Americas y concentra talento de la region centro del pais.",
    colors: ["Rojo", "Negro"],
  },
  "penarol-rugby": {
    slug: "penarol-rugby",
    displayName: "Penarol Rugby",
    country: "Uruguay",
    city: "Montevideo",
    venue: "Montevideo",
    founded: "2019",
    summary: "Franquicia uruguaya vinculada al crecimiento profesional del rugby en Uruguay.",
    history: "Penarol Rugby es uno de los proyectos mas competitivos del rugby profesional sudamericano reciente.",
    colors: ["Amarillo", "Negro"],
  },
  lions: {
    slug: "lions",
    displayName: "Lions",
    country: "South Africa",
    city: "Johannesburg",
    venue: "Emirates Airline Park",
    founded: "1889",
    summary: "Franquicia profesional sudafricana de Johannesburgo que compite en el United Rugby Championship.",
    history:
      "Lions representa al ecosistema del Golden Lions Rugby Union. Despues de su etapa en Super Rugby, paso a competir en el United Rugby Championship y sigue siendo uno de los nombres fuertes del rugby sudafricano.",
    colors: ["Rojo", "Blanco"],
  },
  "old-lions-rc": {
    slug: "old-lions-rc",
    displayName: "Old Lions RC",
    country: "Argentina",
    city: "Santiago del Estero",
    venue: "Santiago del Estero",
    founded: "Club historico",
    summary: "Club del rugby argentino del NOA y participante de la Liga Norte Grande.",
    history:
      "Old Lions RC es una institucion tradicional de Santiago del Estero. No tiene relacion con la franquicia sudafricana Lions del URC, y en RugbyNow queda tratado como un equipo totalmente distinto.",
    colors: ["Rojo", "Blanco"],
  },
  selknam: {
    slug: "selknam",
    displayName: "Selknam",
    country: "Chile",
    city: "Santiago",
    venue: "Santiago",
    founded: "2020",
    summary: "Franquicia chilena del alto rendimiento nacional.",
    history: "Selknam fue uno de los pilares del salto competitivo de Chile en el rugby internacional reciente.",
    colors: ["Azul", "Blanco"],
  },
  "yacare-xv": {
    slug: "yacare-xv",
    displayName: "Yacare XV",
    country: "Paraguay",
    city: "Asuncion",
    venue: "Asuncion",
    founded: "2020s",
    summary: "Franquicia paraguaya dentro de Super Rugby Americas.",
    history: "Yacare XV forma parte del desarrollo profesional del rugby paraguayo en el plano regional.",
    colors: ["Azul", "Blanco"],
  },
  "capibaras-xv": {
    slug: "capibaras-xv",
    displayName: "Capibaras XV",
    country: "Brazil",
    city: "Sao Paulo",
    venue: "Brazil",
    founded: "2020s",
    summary: "Equipo brasileño asociado al crecimiento del rugby profesional en la region.",
    history: "Capibaras XV aparece como una nueva pieza del mapa sudamericano profesional.",
    colors: ["Verde", "Amarillo"],
  },
  "cobras-brasil-rugby": {
    slug: "cobras-brasil-rugby",
    displayName: "Cobras Brasil Rugby",
    country: "Brazil",
    city: "Sao Paulo",
    venue: "Brazil",
    founded: "2020",
    summary: "Franquicia brasileña del circuito profesional sudamericano.",
    history: "Cobras fue el proyecto brasileño inicial dentro del ecosistema de Super Rugby Americas.",
    colors: ["Verde", "Amarillo"],
  },
  "stade-toulousain": {
    slug: "stade-toulousain",
    displayName: "Stade Toulousain",
    country: "France",
    city: "Toulouse",
    venue: "Toulouse",
    founded: "1907",
    summary: "Uno de los clubes mas grandes y exitosos del rugby europeo.",
    history: "Stade Toulousain es una potencia historica del Top 14 y de la Champions Cup.",
    colors: ["Rojo", "Negro"],
  },
  leinster: {
    slug: "leinster",
    displayName: "Leinster Rugby",
    country: "Ireland",
    city: "Dublin",
    venue: "Dublin",
    founded: "Provincial era",
    summary: "Potencia irlandesa del rugby europeo.",
    history: "Leinster domina hace años tanto el frente domestico como las competencias europeas.",
    colors: ["Azul"],
  },
  munster: {
    slug: "munster",
    displayName: "Munster Rugby",
    country: "Ireland",
    city: "Limerick / Cork",
    venue: "Munster",
    founded: "Provincial era",
    summary: "Provincia historica del rugby irlandes.",
    history: "Munster construyo una identidad muy fuerte en Europa a partir de sus campañas coperas.",
    colors: ["Rojo"],
  },
};

const COUNTRY_BY_SLUG_PREFIX: Array<[string, string]> = [
  ["argentina", "Argentina"],
  ["uruguay", "Uruguay"],
  ["chile", "Chile"],
  ["brazil", "Brazil"],
  ["france", "France"],
  ["italy", "Italy"],
  ["ireland", "Ireland"],
  ["scotland", "Scotland"],
  ["wales", "Wales"],
  ["south-africa", "South Africa"],
  ["usa", "United States"],
  ["japan", "Japan"],
];

export function getTeamProfile(slug: string, name?: string | null): TeamProfile {
  const direct = TEAM_PROFILES[slug];
  if (direct) return direct;

  const inferredCountry =
    COUNTRY_BY_SLUG_PREFIX.find(([prefix]) => slug === prefix || slug.startsWith(`${prefix}-`))?.[1] ?? undefined;

  return {
    slug,
    displayName: name ?? slug,
    country: inferredCountry,
    summary: `${name ?? slug} forma parte de RugbyNow. Esta ficha se ira completando con informacion del club, su sede, historia y datos institucionales.`,
    history: "Perfil en construccion. A medida que carguemos metadata manual, esta pagina va a sumar fundacion, estadio, ciudad, colores e historia.",
  };
}
