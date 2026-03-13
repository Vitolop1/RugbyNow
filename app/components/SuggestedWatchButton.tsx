"use client";

import { useEffect, useRef, useState } from "react";
import { getWatchOptions } from "@/lib/broadcasts";
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const options = getWatchOptions({ competitionSlug, home, away });
  const tr = (key: string) => t(lang, key);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!options.length) return null;

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center rounded-full border border-sky-200/30 bg-sky-300/20 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-sky-300/30"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {tr("watchAlternatives")}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 rounded-2xl border border-white/15 bg-[#062f22]/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/60">
              {tr("watchAlternatives")}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/20 text-xs font-bold text-white/80 transition hover:bg-black/30"
              aria-label={tr("close")}
            >
              x
            </button>
          </div>

          <div className="space-y-2">
            {options.map((option) => (
              <a
                key={`${option.label}-${option.href}`}
                href={option.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 transition hover:bg-white/10"
              >
                <span>{option.label === "Google" ? tr("searchWhereToWatch") : option.label}</span>
                <span className="text-white/45">{"->"}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
