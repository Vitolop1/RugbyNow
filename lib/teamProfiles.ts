import generatedTeamProfiles from "@/data/team-profiles.generated.json";

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

const TEAM_PROFILE_OVERRIDES: Record<string, Partial<TeamProfile>> = {
  "pampas-xv": {
    colors: ["Celeste", "Blanco"],
  },
  "dogos-xv": {
    colors: ["Rojo", "Negro"],
  },
  "penarol-rugby": {
    colors: ["Amarillo", "Negro"],
  },
  lions: {
    displayName: "Lions",
    country: "South Africa",
    city: "Johannesburg",
    venue: "Emirates Airline Park",
    founded: "1889",
    summary:
      "Lions es la franquicia profesional de Johannesburgo que representa al ecosistema de Golden Lions dentro del United Rugby Championship.",
    history:
      "Despues de su etapa en Super Rugby, la franquicia paso a competir en el URC. En RugbyNow queda diferenciada del club argentino Old Lions RC para evitar mezclar identidades distintas.",
    colors: ["Rojo", "Blanco"],
  },
  "old-lions-rc": {
    displayName: "Old Lions RC",
    summary:
      "Old Lions RC es un club de Santiago del Estero con presencia en el rugby del norte argentino y sin relacion institucional con la franquicia sudafricana Lions.",
    history:
      "Lo dejamos curado de forma explicita en RugbyNow para separar al club santiagueno de la franquicia profesional del URC y evitar cruces de logos o descripciones.",
    colors: ["Rojo", "Blanco"],
  },
  selknam: {
    colors: ["Azul", "Blanco"],
  },
  "yacare-xv": {
    colors: ["Azul", "Blanco"],
  },
  "capibaras-xv": {
    colors: ["Verde", "Amarillo"],
  },
  "cobras-brasil-rugby": {
    colors: ["Verde", "Amarillo"],
  },
  "stade-toulousain": {
    colors: ["Rojo", "Negro"],
  },
  leinster: {
    colors: ["Azul"],
  },
  munster: {
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
  const generated =
    (generatedTeamProfiles as {
      profiles?: Record<string, TeamProfile>;
    }).profiles?.[slug] ?? null;
  const override = TEAM_PROFILE_OVERRIDES[slug] ?? {};

  if (generated) {
    return {
      ...generated,
      ...override,
      colors: override.colors ?? generated.colors,
    };
  }

  const inferredCountry =
    COUNTRY_BY_SLUG_PREFIX.find(([prefix]) => slug === prefix || slug.startsWith(`${prefix}-`))?.[1] ?? undefined;

  return {
    slug,
    displayName: name ?? titleFromSlug(slug),
    country: inferredCountry,
    ...override,
    summary:
      override.summary ??
      `${name ?? titleFromSlug(slug)} forma parte de RugbyNow. Esta ficha se ira completando con informacion del club, su sede, historia y datos institucionales.`,
    history:
      override.history ??
      "Perfil en construccion. A medida que carguemos metadata manual y automatica, esta pagina va a sumar fundacion, estadio, ciudad, colores e historia.",
  };
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
