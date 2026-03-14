"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ThemeMode } from "@/lib/usePrefs";

type Props = {
  theme: ThemeMode;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  fallbackClassName?: string;
};

export default function BrandWordmark({
  theme,
  alt = "RugbyNow",
  width,
  height,
  className,
  priority,
  fallbackClassName,
}: Props) {
  const sources = useMemo(() => {
    if (theme === "light") {
      return ["/logohorizontal-black.png", "/logohorizontal-light.png", "/logohorizontal.png"];
    }
    if (theme === "dark") {
      return ["/logohorizontal-dark.png", "/logohorizontal.png"];
    }
    return ["/logohorizontal.png"];
  }, [theme]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const activeSource = sources[sourceIndex];
  const tone = theme === "light" && activeSource === "/logohorizontal.png" ? "filtered" : "native";

  if (showFallback) {
    return (
      <h1 className={fallbackClassName ?? "text-[22px] font-extrabold leading-none tracking-tight rn-text-primary sm:text-[26px]"}>
        Rugby<span className={theme === "light" ? "text-slate-700" : "text-emerald-300"}>Now</span>
      </h1>
    );
  }

  return (
    <Image
      src={sources[sourceIndex]}
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-brand-wordmark="true"
      data-brand-wordmark-tone={tone}
      priority={priority}
      onError={() => {
        if (sourceIndex < sources.length - 1) {
          setSourceIndex((current) => current + 1);
          return;
        }
        setShowFallback(true);
      }}
    />
  );
}
