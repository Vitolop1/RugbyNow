"use client";

import CountryFlag from "@/app/components/CountryFlag";

const SPECIAL_ICON_BY_KEY: Record<string, string | null> = {
  featured: null,
  franchises: "/league-logos/int-super-rugby-pacific.png",
  selections: "/league-logos/int-world-cup.png",
  seven: "/league-logos/Rugby_World_Cup_Sevens_logo.png",
  other: null,
};

type CompetitionSectionBadgeProps = {
  badgeKey: string;
  alt: string;
  size?: number;
};

export default function CompetitionSectionBadge({
  badgeKey,
  alt,
  size = 18,
}: CompetitionSectionBadgeProps) {
  const normalized = badgeKey.trim().toLowerCase();
  const isCountry = !SPECIAL_ICON_BY_KEY.hasOwnProperty(normalized);

  if (isCountry) {
    return <CountryFlag country={normalized} alt={alt} size={size} />;
  }

  const src = SPECIAL_ICON_BY_KEY[normalized];
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="shrink-0 rounded-sm bg-white/5 object-contain"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/20 text-[11px] font-black text-white/85"
      style={{ width: size, height: size, minWidth: size }}
      aria-label={alt}
      title={alt}
    >
      ★
    </span>
  );
}
