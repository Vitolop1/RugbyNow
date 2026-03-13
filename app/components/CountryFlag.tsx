"use client";

import { useMemo } from "react";

const COUNTRY_META: Record<string, { sources: string[]; fallback: string }> = {
  argentina: { sources: ["/flags/Flag_of_Argentina.png", "/country-flags/argentina.png"], fallback: "AR" },
  ar: { sources: ["/flags/Flag_of_Argentina.png", "/country-flags/argentina.png"], fallback: "AR" },
  england: { sources: ["/flags/Flag_of_England.png", "/country-flags/england.png"], fallback: "EN" },
  en: { sources: ["/flags/Flag_of_England.png", "/country-flags/england.png"], fallback: "EN" },
  france: { sources: ["/flags/Flag_of_France.png", "/country-flags/france.png"], fallback: "FR" },
  fr: { sources: ["/flags/Flag_of_France.png", "/country-flags/france.png"], fallback: "FR" },
  italy: { sources: ["/flags/Flag_of_Italy.png", "/flags/Flag_of_Italy.svg.webp", "/country-flags/italy.png"], fallback: "IT" },
  it: { sources: ["/flags/Flag_of_Italy.png", "/flags/Flag_of_Italy.svg.webp", "/country-flags/italy.png"], fallback: "IT" },
  spain: { sources: ["/country-flags/spain.png"], fallback: "ES" },
  es: { sources: ["/country-flags/spain.png"], fallback: "ES" },
  germany: { sources: ["/country-flags/germany.png"], fallback: "DE" },
  de: { sources: ["/country-flags/germany.png"], fallback: "DE" },
  portugal: { sources: ["/country-flags/portugal.png"], fallback: "PT" },
  pt: { sources: ["/country-flags/portugal.png"], fallback: "PT" },
  brazil: { sources: ["/flags/Flag_of_Brazil.png", "/country-flags/brazil.png"], fallback: "BR" },
  br: { sources: ["/flags/Flag_of_Brazil.png", "/country-flags/brazil.png"], fallback: "BR" },
  uruguay: { sources: ["/flags/Flag_of_Uruguay.png", "/country-flags/uruguay.png"], fallback: "UY" },
  uy: { sources: ["/flags/Flag_of_Uruguay.png", "/country-flags/uruguay.png"], fallback: "UY" },
  paraguay: { sources: ["/flags/Flag_of_Paraguay.png", "/country-flags/paraguay.png"], fallback: "PY" },
  py: { sources: ["/flags/Flag_of_Paraguay.png", "/country-flags/paraguay.png"], fallback: "PY" },
  colombia: { sources: ["/country-flags/colombia.png"], fallback: "CO" },
  co: { sources: ["/country-flags/colombia.png"], fallback: "CO" },
  chile: { sources: ["/flags/Flag_of_Chile.png", "/country-flags/chile.png"], fallback: "CL" },
  cl: { sources: ["/flags/Flag_of_Chile.png", "/country-flags/chile.png"], fallback: "CL" },
  mexico: { sources: ["/country-flags/mexico.png"], fallback: "MX" },
  mx: { sources: ["/country-flags/mexico.png"], fallback: "MX" },
  usa: { sources: ["/flags/Flag_of_the_United_States.png", "/country-flags/usa.png"], fallback: "US" },
  us: { sources: ["/flags/Flag_of_the_United_States.png", "/country-flags/usa.png"], fallback: "US" },
  europe: { sources: ["/flags/European_flag.png"], fallback: "EU" },
  eu: { sources: ["/flags/European_flag.png"], fallback: "EU" },
  southamerica: { sources: ["/flags/southamerica.png"], fallback: "SA" },
  sudamerica: { sources: ["/flags/southamerica.png"], fallback: "SA" },
};

type CountryFlagProps = {
  country: string;
  alt: string;
  size?: number;
  className?: string;
  fallbackClassName?: string;
};

export default function CountryFlag({
  country,
  alt,
  size = 18,
  className = "",
  fallbackClassName = "",
}: CountryFlagProps) {
  const key = country.trim().toLowerCase();
  const meta = useMemo(() => COUNTRY_META[key], [key]);

  if (!meta) {
    const fallback = country.slice(0, 2).toUpperCase();
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/20 text-[10px] font-black text-white/85 ${fallbackClassName}`}
        style={{ width: size, height: size, minWidth: size }}
        aria-label={alt}
        title={alt}
      >
        {fallback}
      </span>
    );
  }

  return (
    <>
      <img
        src={meta.sources[0]}
        alt={alt}
        width={size}
        height={size}
        data-source-index="0"
        className={`shrink-0 rounded-full border border-white/10 bg-white/5 object-cover ${className}`}
        onError={(event) => {
          const current = Number(event.currentTarget.dataset.sourceIndex ?? "0");
          const next = current + 1;

          if (next < meta.sources.length) {
            event.currentTarget.dataset.sourceIndex = String(next);
            event.currentTarget.src = meta.sources[next];
            return;
          }

          event.currentTarget.style.display = "none";
          const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "inline-flex";
        }}
      />
      <span
        className={`hidden shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/20 text-[10px] font-black text-white/85 ${fallbackClassName}`}
        style={{ width: size, height: size, minWidth: size }}
        aria-label={alt}
        title={alt}
      >
        {meta.fallback}
      </span>
    </>
  );
}
