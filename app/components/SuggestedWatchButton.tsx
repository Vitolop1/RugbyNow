"use client";

import { getSuggestedWatchLink } from "@/lib/broadcasts";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/usePrefs";

type Props = {
  competitionSlug?: string | null;
  home?: string | null;
  away?: string | null;
  lang: Lang;
  className?: string;
};

export default function SuggestedWatchButton({ competitionSlug, home, away, lang, className }: Props) {
  const suggested = getSuggestedWatchLink({ competitionSlug, home, away });
  if (!suggested) return null;

  const tr = (key: string) => t(lang, key);

  return (
    <a
      href={suggested.href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center rounded-full border border-sky-200/30 bg-sky-300/20 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-sky-300/30 ${className ?? ""}`}
      aria-label={`${tr("suggestedLink")} | ${suggested.label}`}
      title={`${tr("suggestedLink")} | ${suggested.label}`}
    >
      {tr("suggestedLink")} | {suggested.label}
    </a>
  );
}
