"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { WATCH_PLACEHOLDER_OPTIONS } from "@/lib/watchPlaceholderOptions";
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
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const tr = (key: string) => t(lang, key);
  const title = home?.trim() && away?.trim() ? `${home.trim()} vs ${away.trim()}` : competitionName?.trim() || competitionSlug || "Rugby";

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
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

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const menuWidth = Math.min(360, Math.max(280, window.innerWidth - 16));
      const measuredHeight = menuRef.current?.offsetHeight ?? 0;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      const belowTop = rect.bottom + 8;
      const top =
        measuredHeight > 0 && belowTop + measuredHeight > window.innerHeight - 8 && rect.top - measuredHeight - 8 >= 8
          ? rect.top - measuredHeight - 8
          : belowTop;

      setMenuStyle({ top, left, width: menuWidth });
    };

    updatePosition();
    const rafId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className ?? ""}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-sky-200/30 bg-sky-300/20 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-sky-300/30"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={tr("watchMatch")}
        title={tr("watchMatch")}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {"\u{1F4FA}"}
        </span>
        <span>{tr("watchMatch")}</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120] rounded-2xl border border-white/15 bg-[#062f22]/95 p-3 shadow-2xl backdrop-blur"
              style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
                    {tr("watchAlternatives")}
                  </div>
                  <div className="mt-1 truncate text-sm font-bold text-white">{title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/20 text-xs font-bold text-white/80 transition hover:bg-black/30"
                  aria-label={tr("close")}
                >
                  x
                </button>
              </div>

              <div className="space-y-2">
                {WATCH_PLACEHOLDER_OPTIONS.map((option) => (
                  <a
                    key={option.id}
                    href={option.placeholderHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    <span>{option.name}</span>
                    <span className="text-white/45">{"->"}</span>
                  </a>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
