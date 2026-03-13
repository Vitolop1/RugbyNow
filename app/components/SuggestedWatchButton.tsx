"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/usePrefs";

type Props = {
  competitionSlug?: string | null;
  competitionName?: string | null;
  home?: string | null;
  away?: string | null;
  lang: Lang;
  className?: string;
};

export default function SuggestedWatchButton({
  competitionSlug,
  competitionName,
  home,
  away,
  lang,
  className,
}: Props) {
  const tr = (key: string) => t(lang, key);

  const params = new URLSearchParams();
  if (competitionSlug) params.set("competitionSlug", competitionSlug);
  if (competitionName) params.set("competitionName", competitionName);
  if (home) params.set("home", home);
  if (away) params.set("away", away);

  const href = params.size ? `/watch?${params.toString()}` : "/watch";

  return (
    <Link
      href={href}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-200/30 bg-sky-300/20 text-lg text-white transition hover:bg-sky-300/30 ${className ?? ""}`}
      aria-label={tr("watchMatch")}
      title={tr("watchMatch")}
    >
      <span aria-hidden="true">{"\u{1F4FA}"}</span>
    </Link>
  );
}
