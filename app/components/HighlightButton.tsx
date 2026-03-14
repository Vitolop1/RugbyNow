"use client";

import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/usePrefs";

type Props = {
  href: string;
  title?: string | null;
  lang: Lang;
  className?: string;
};

export default function HighlightButton({ href, title, lang, className }: Props) {
  const tr = (key: string) => t(lang, key);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full border border-red-200/35 bg-red-500/20 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-red-500/30"
      }
      aria-label={title || tr("watchHighlight")}
      title={title || tr("watchHighlight")}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        ▶
      </span>
      <span>{tr("watchHighlight")}</span>
    </a>
  );
}
