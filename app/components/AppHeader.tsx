// app/components/AppHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { usePrefs, type Lang } from "@/lib/usePrefs";

type Props = {
  title?: React.ReactNode;
  subtitle?: string;

  showTabs?: boolean;
  tab?: "ALL" | "LIVE";
  setTab?: (t: "ALL" | "LIVE") => void;

  // opcional: si querés forzar lang desde una página
  lang?: Lang;
  onLangChange?: (l: Lang) => void;
};

function formatTodayTZ(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone,
  }).format(now);
}

function formatClockTZ(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(now);
}

function formatSecondsTZ(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    second: "2-digit",
    timeZone,
  }).format(now);
}

export default function AppHeader({
  title,
  subtitle,
  showTabs,
  tab,
  setTab,
  lang: langProp,
  onLangChange,
}: Props) {
  const { mounted, timeZone, setTZEverywhere, lang, setLangEverywhere, dark, setThemeEverywhere } = usePrefs();

  const [nowTick, setNowTick] = useState<number | null>(null);
  const now = useMemo(() => (nowTick != null ? new Date(nowTick) : null), [nowTick]);

  const [logoOk, setLogoOk] = useState(true);

  const effectiveLang = langProp ?? lang;

  // clock
  useEffect(() => {
    const tick = () => setNowTick(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const setLanguageEverywhere = (next: Lang) => {
    onLangChange?.(next);
    setLangEverywhere(next);
  };

  const CenterTitle = (
    <div className="text-center select-none">
      {title ? (
        <div className="min-w-0">
          <div className="text-[18px] sm:text-[22px] font-extrabold truncate">{title}</div>
          {subtitle ? <div className="text-[11px] opacity-70 truncate">{subtitle}</div> : null}
        </div>
      ) : (
        <h1 className="text-[22px] sm:text-[26px] leading-none font-extrabold tracking-tight whitespace-nowrap">
          Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
        </h1>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-3">
        {/* ROW 1 */}
        <div className="relative flex items-center">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl shadow overflow-hidden bg-white/80 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 flex items-center justify-center">
              {logoOk ? (
                <Image
                  src="/logo.jpg"
                  alt="RugbyNow logo"
                  width={48}
                  height={48}
                  className="h-full w-full object-contain object-center p-1"
                  onError={() => setLogoOk(false)}
                  priority
                />
              ) : (
                <span className="text-xs font-black">RN</span>
              )}
            </div>
          </Link>

          <div className="absolute left-1/2 -translate-x-1/2 max-w-[70%] sm:max-w-[80%]">{CenterTitle}</div>

          <div className="ml-auto h-11 w-11 sm:h-12 sm:w-12" />
        </div>

        {/* ROW 2 */}
        <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex items-center gap-2 flex-nowrap overflow-x-auto [-webkit-overflow-scrolling:touch] h-9 w-full pr-12">
            {/* Language */}
            <div className="inline-flex items-center gap-2 h-9 rounded-full border border-neutral-200 bg-white/70 px-2 dark:border-white/10 dark:bg-white/5 shrink-0">
              <span className="text-sm" aria-hidden="true">
                🌐
              </span>
              <select
                value={effectiveLang}
                onChange={(e) => setLanguageEverywhere(e.target.value as Lang)}
                className="h-9 bg-transparent text-xs sm:text-sm font-semibold outline-none cursor-pointer text-neutral-900 dark:text-white"
                aria-label="Select language"
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="fr">FR</option>
              </select>
            </div>

            {/* Timezone */}
            <select
              value={timeZone}
              onChange={(e) => setTZEverywhere(e.target.value)}
              className="h-9 px-2 rounded-full text-xs sm:text-sm border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10 shrink-0 w-[110px] sm:w-auto"
              title="Timezone"
            >
              <option value="America/New_York">New York (ET)</option>
              <option value="America/Chicago">Chicago (CT)</option>
              <option value="America/Denver">Denver (MT)</option>
              <option value="America/Los_Angeles">Los Angeles (PT)</option>
              <option value="America/Argentina/Buenos_Aires">Argentina (ART)</option>
              <option value="Europe/London">London (GMT)</option>
            </select>

            {/* Tabs */}
            {showTabs && tab && setTab ? (
              <div className="inline-flex h-9 rounded-full border border-neutral-200 bg-white/80 dark:bg-neutral-900 dark:border-white/10 overflow-hidden shrink-0">
                <button
                  onClick={() => setTab("ALL")}
                  className={`h-9 px-3 text-xs sm:text-sm font-semibold transition ${
                    tab === "ALL" ? "bg-emerald-600 text-white" : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTab("LIVE")}
                  className={`h-9 px-3 text-xs sm:text-sm font-semibold transition ${
                    tab === "LIVE" ? "bg-red-600 text-white" : "hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  Live
                </button>
              </div>
            ) : null}

            {/* Theme pinned */}
            <button
              onClick={() => setThemeEverywhere(!dark)}
              className="absolute right-0 top-0 h-9 w-9 rounded-full text-sm border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10 flex items-center justify-center"
              title="Toggle theme"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>

          {/* Time widgets md+ */}
          <div className="hidden md:flex md:ml-auto items-center gap-3">
            <div className="w-[190px] h-[56px] px-4 py-2 rounded-2xl border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10 flex flex-col justify-center">
              <div className="text-[11px] font-semibold text-neutral-600 dark:text-white/60">Today</div>
              <div className="mt-1 text-base font-extrabold leading-tight truncate">
                {mounted && now ? formatTodayTZ(now, timeZone) : "—"}
              </div>
            </div>

            <div className="w-[190px] h-[56px] px-4 py-2 rounded-2xl border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10 flex flex-col justify-center">
              <div className="text-[11px] font-semibold text-neutral-600 dark:text-white/60">Time</div>
              <div className="mt-1 text-base font-extrabold tabular-nums leading-tight">
                {mounted && now ? formatClockTZ(now, timeZone) : "--:--"}
                <span className="ml-1 text-sm font-black opacity-80">
                  {mounted && now ? formatSecondsTZ(now, timeZone) : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile mini time */}
          <div className="md:hidden text-xs opacity-75">
            {mounted && now ? (
              <span className="font-semibold">
                {formatTodayTZ(now, timeZone)} • {formatClockTZ(now, timeZone)}:{formatSecondsTZ(now, timeZone)}
              </span>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}