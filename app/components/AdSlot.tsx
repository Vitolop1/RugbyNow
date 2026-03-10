"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  slot?: string;
  format?: "auto" | "horizontal" | "vertical" | "rectangle";
  className?: string;
  minHeight?: number;
  fallbackTitle: string;
  fallbackSubtitle: string;
};

function AdFallback({
  title,
  subtitle,
  className,
  minHeight,
}: {
  title: string;
  subtitle: string;
  className?: string;
  minHeight: number;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-dashed border-emerald-200/25 bg-black/20 backdrop-blur ${className ?? ""}`}
      style={{ minHeight }}
    >
      <div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.14),_transparent_50%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] p-5">
        <div>
          <div className="inline-flex rounded-full border border-emerald-200/20 bg-emerald-300/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-100/85">
            Ad Space
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-white">{title}</h3>
          <p className="mt-1 max-w-[28ch] text-sm text-white/75">{subtitle}</p>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          <span>Temporal placeholder</span>
          <span className="font-semibold text-white/80">AdSense slot pendiente</span>
        </div>
      </div>
    </div>
  );
}

export default function AdSlot({
  slot,
  format = "auto",
  className,
  minHeight = 140,
  fallbackTitle,
  fallbackSubtitle,
}: AdSlotProps) {
  const pushedRef = useRef(false);
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  useEffect(() => {
    if (!slot || pushedRef.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // Leave the slot mounted; AdSense can retry after hydration.
    }
  }, [slot]);

  if (!slot) {
    return (
      <AdFallback
        title={fallbackTitle}
        subtitle={fallbackSubtitle}
        className={className}
        minHeight={minHeight}
      />
    );
  }

  const adFormat = format === "horizontal" || format === "vertical" || format === "rectangle" ? "auto" : format;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-dashed border-emerald-200/25 bg-black/10 backdrop-blur ${className ?? ""}`}
      style={{ minHeight }}
    >
      {isLocalhost ? (
        <AdFallback
          title={fallbackTitle}
          subtitle="En localhost AdSense suele no servir anuncios reales. Verificalo en produccion o preview."
          minHeight={minHeight}
        />
      ) : null}
      <ins
        className={`adsbygoogle block h-full w-full ${isLocalhost ? "opacity-0 pointer-events-none absolute inset-0" : ""}`}
        style={{ display: "block", minHeight }}
        data-ad-client="ca-pub-4088690490762441"
        data-ad-slot={slot}
        data-ad-format={adFormat}
        data-full-width-responsive={format === "horizontal" ? "true" : "false"}
        data-adtest={isLocalhost ? "on" : undefined}
      />
    </div>
  );
}
