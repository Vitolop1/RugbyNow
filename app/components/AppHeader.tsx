"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import BrandWordmark from "@/app/components/BrandWordmark";
import { t } from "@/lib/i18n";
import { usePrefs, type Lang, type ThemeMode } from "@/lib/usePrefs";

type Props = {
  title?: React.ReactNode;
  subtitle?: string;
  showTabs?: boolean;
  tab?: "ALL" | "LIVE";
  setTab?: (tab: "ALL" | "LIVE") => void;
  lang?: Lang;
  onLangChange?: (lang: Lang) => void;
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
  return new Intl.DateTimeFormat(undefined, { second: "2-digit", timeZone }).format(now);
}

function ThemeGlyph({ theme }: { theme: ThemeMode }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="4.25" />
        <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46" />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor">
        <path d="M15.9 2.6a8.55 8.55 0 1 0 5.5 14.94 9.2 9.2 0 0 1-1.97.21A9 9 0 0 1 10.45 8.8c0-2.22.8-4.27 2.12-5.86a8.5 8.5 0 0 0 3.33-.34Z" />
      </svg>
    );
  }

  return (
    <span className="relative block h-[18px] w-[18px] overflow-hidden rounded-full">
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={18}
        height={18}
        className="h-full w-full scale-[1.14] object-cover object-[52%_48%]"
      />
    </span>
  );
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
  const { mounted, timeZone, setTZEverywhere, lang, setLangEverywhere, theme, setThemeEverywhere } = usePrefs();
  const [nowTick, setNowTick] = useState<number | null>(null);
  const [logoOk, setLogoOk] = useState(true);

  const now = useMemo(() => (nowTick != null ? new Date(nowTick) : null), [nowTick]);
  const effectiveLang = langProp ?? lang;
  const tr = (key: string) => t(effectiveLang, key);
  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: "rugby", label: tr("themeRugby") },
    { value: "light", label: tr("themeDay") },
    { value: "dark", label: tr("themeNight") },
  ];

  useEffect(() => {
    const tick = () => setNowTick(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const setLanguageEverywhere = (nextLang: Lang) => {
    onLangChange?.(nextLang);
    setLangEverywhere(nextLang);
  };

  return (
    <header className="rn-header-shell sticky top-0 z-50 backdrop-blur">
      <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6">
        <div className="relative flex items-center">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="rn-header-pill flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl shadow sm:h-[54px] sm:w-[54px]">
              {logoOk ? (
                <Image
                  src="/logo.png"
                  alt="RugbyNow logo"
                  width={54}
                  height={54}
                  className="h-full w-full scale-[1.14] object-cover object-[52%_48%]"
                  onError={() => setLogoOk(false)}
                  priority
                />
              ) : (
                <span className="text-xs font-black text-white">RN</span>
              )}
            </div>
          </Link>

          <div className="absolute left-1/2 max-w-[70%] -translate-x-1/2 sm:max-w-[80%]">
            <Link href="/" className="flex items-center justify-center">
              <BrandWordmark
                key={`header-brand-${theme}`}
                theme={theme}
                width={312}
                height={62}
                className="h-auto w-[215px] object-contain sm:w-[288px]"
                fallbackClassName="whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight rn-text-primary sm:text-[26px]"
                priority
              />
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/leagues"
              className="rn-header-pill hidden h-9 items-center px-3 text-xs font-extrabold sm:inline-flex"
            >
              {tr("leagues")}
            </Link>
            <Link
              href="/weekly"
              className="rn-header-pill hidden h-9 items-center px-3 text-xs font-extrabold sm:inline-flex"
            >
              {tr("weekly")}
            </Link>
            <Link
              href="/about"
              className="rn-header-pill hidden h-9 items-center px-3 text-xs font-extrabold sm:inline-flex"
            >
              {tr("about")}
            </Link>
            <div className="h-11 w-11 sm:hidden" />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex h-9 w-full flex-nowrap items-center gap-2 overflow-x-auto pr-16 [-webkit-overflow-scrolling:touch]">
            <div className="rn-header-pill inline-flex h-9 shrink-0 items-center gap-2 px-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] rn-text-muted" aria-hidden="true">
                Lang
              </span>
              <select
                value={effectiveLang}
                onChange={(e) => setLanguageEverywhere(e.target.value as Lang)}
                className="h-9 cursor-pointer bg-transparent text-xs font-semibold rn-text-primary outline-none sm:text-sm"
                aria-label={tr("language")}
              >
                <option className="text-black" value="en">
                  EN
                </option>
                <option className="text-black" value="es">
                  ES
                </option>
                <option className="text-black" value="fr">
                  FR
                </option>
                <option className="text-black" value="it">
                  IT
                </option>
              </select>
            </div>

            <select
              value={timeZone}
              onChange={(e) => setTZEverywhere(e.target.value)}
              className="rn-header-pill h-9 w-[140px] shrink-0 px-2 text-xs sm:w-auto sm:text-sm"
              title={tr("timezoneTitle")}
            >
              <option className="text-black" value="America/New_York">
                New York (ET)
              </option>
              <option className="text-black" value="America/Chicago">
                Chicago (CT)
              </option>
              <option className="text-black" value="America/Denver">
                Denver (MT)
              </option>
              <option className="text-black" value="America/Los_Angeles">
                Los Angeles (PT)
              </option>
              <option className="text-black" value="America/Argentina/Buenos_Aires">
                Argentina (ART)
              </option>
              <option className="text-black" value="Europe/London">
                London (GMT)
              </option>
            </select>

            {showTabs && tab && setTab ? (
              <div className="rn-header-pill inline-flex h-9 shrink-0 overflow-hidden">
                <button
                  onClick={() => setTab("ALL")}
                  className={`h-9 px-3 text-xs font-semibold transition sm:text-sm ${
                    tab === "ALL" ? "bg-emerald-300 text-black" : "rn-text-primary hover:bg-white/10"
                  }`}
                >
                  {tr("all")}
                </button>
                <button
                  onClick={() => setTab("LIVE")}
                  className={`h-9 px-3 text-xs font-semibold transition sm:text-sm ${
                    tab === "LIVE" ? "bg-red-500 text-white" : "rn-text-primary hover:bg-white/10"
                  }`}
                >
                  {tr("live")}
                </button>
              </div>
            ) : null}

            <div className="absolute right-0 top-0 flex h-9 items-center gap-1">
              {themeOptions.map((option) => {
                const active = theme === option.value;
                const activeClass =
                  option.value === "rugby"
                    ? "bg-emerald-300 text-black shadow-sm"
                    : option.value === "light"
                      ? "bg-amber-200 text-slate-900 shadow-sm"
                      : "bg-slate-900 text-white shadow-sm";

                return (
                  <button
                    key={option.value}
                    onClick={() => setThemeEverywhere(option.value)}
                    className={`rn-header-pill flex h-9 w-9 items-center justify-center px-0 text-sm transition ${
                      active ? activeClass : "rn-text-primary hover:bg-white/10"
                    }`}
                    title={option.label}
                    aria-label={option.label}
                  >
                    <span aria-hidden="true">
                      <ThemeGlyph theme={option.value} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden items-center gap-3 md:ml-auto md:flex">
            <div className="rn-header-card flex h-[56px] w-[190px] flex-col justify-center px-4 py-2">
              <div className="text-[11px] font-semibold rn-text-muted">{tr("today")}</div>
              <div className="mt-1 truncate text-base font-extrabold leading-tight">
                {mounted && now ? formatTodayTZ(now, timeZone) : ""}
              </div>
            </div>

            <div className="rn-header-card flex h-[56px] w-[190px] flex-col justify-center px-4 py-2">
              <div className="text-[11px] font-semibold rn-text-muted">{tr("time")}</div>
              <div className="mt-1 text-base font-extrabold leading-tight tabular-nums">
                {mounted && now ? formatClockTZ(now, timeZone) : "--:--"}
                <span className="ml-1 text-sm font-black rn-text-muted">
                  {mounted && now ? formatSecondsTZ(now, timeZone) : "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs rn-text-primary md:hidden">
            {mounted && now ? (
              <span className="font-semibold">
                {formatTodayTZ(now, timeZone)} | {formatClockTZ(now, timeZone)}:{formatSecondsTZ(now, timeZone)}
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>

        {title ? (
          <div className="mt-3 text-center">
            <div className="truncate text-sm font-extrabold rn-text-primary sm:text-base">{title}</div>
            {subtitle ? <div className="truncate text-xs rn-text-muted">{subtitle}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
