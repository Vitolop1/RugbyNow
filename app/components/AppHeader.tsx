"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import BrandWordmark from "@/app/components/BrandWordmark";
import { getDateLocale } from "@/lib/dateLocale";
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

type LanguageOption = {
  value: Lang;
  label: string;
  short: string;
  src?: string;
  emoji?: string;
};

type TimeZoneOption = {
  value: string;
  short: string;
  long: string;
};

function formatTodayTZ(now: Date, timeZone: string, lang: Lang) {
  return new Intl.DateTimeFormat(getDateLocale(lang), {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone,
  }).format(now);
}

function formatClockTZ(now: Date, timeZone: string, lang: Lang) {
  return new Intl.DateTimeFormat(getDateLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(now);
}

function formatSecondsTZ(now: Date, timeZone: string, lang: Lang) {
  return new Intl.DateTimeFormat(getDateLocale(lang), { second: "2-digit", timeZone }).format(now);
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

function LanguageChip({
  option,
  compact = false,
}: {
  option: LanguageOption;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white/10 text-[11px] leading-none">
        {option.src ? (
          <Image
            src={option.src}
            alt=""
            aria-hidden="true"
            width={20}
            height={20}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{option.emoji ?? option.short}</span>
        )}
      </span>
      {!compact ? <span className="truncate">{option.short}</span> : null}
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
  const languageOptions: LanguageOption[] = [
    { value: "es", label: "Espanol", short: "ES", src: "/flags/Flag_of_Spain.png" },
    { value: "en", label: "English", short: "EN", src: "/flags/Flag_of_England.png" },
    { value: "fr", label: "Francais", short: "FR", src: "/flags/Flag_of_France.png" },
    { value: "it", label: "Italiano", short: "IT", src: "/flags/Flag_of_Italy.png" },
  ];
  const timeZoneOptions: TimeZoneOption[] = [
    { value: "America/New_York", short: "NY (ET)", long: "New York (ET)" },
    { value: "America/Chicago", short: "CHI (CT)", long: "Chicago (CT)" },
    { value: "America/Denver", short: "DEN (MT)", long: "Denver (MT)" },
    { value: "America/Los_Angeles", short: "LA (PT)", long: "Los Angeles (PT)" },
    { value: "America/Argentina/Buenos_Aires", short: "ARG", long: "Argentina (ART)" },
    { value: "Europe/London", short: "LON", long: "London (GMT)" },
  ];
  const currentLanguage = languageOptions.find((option) => option.value === effectiveLang) ?? languageOptions[0];
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
          <Link href="/" className="hidden shrink-0 items-center gap-3 sm:flex" aria-label="RugbyNow home">
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

          <div className="absolute left-1/2 max-w-[74%] -translate-x-1/2 sm:max-w-[80%]">
            <Link href="/" className="flex items-center justify-center" aria-label="RugbyNow home">
              <BrandWordmark
                key={`header-brand-${theme}`}
                theme={theme}
                width={312}
                height={62}
                className="h-auto w-[196px] object-contain sm:w-[288px]"
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

        <div className="mt-3 space-y-2 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="rn-header-pill inline-flex h-9 min-w-[72px] shrink-0 items-center gap-1.5 px-2">
              <LanguageChip option={currentLanguage} compact />
              <select
                value={effectiveLang}
                onChange={(e) => setLanguageEverywhere(e.target.value as Lang)}
                className="h-9 min-w-[36px] cursor-pointer bg-transparent pr-1 text-xs font-semibold rn-text-primary outline-none"
                aria-label={tr("language")}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} className="text-black" value={option.value}>
                    {option.short}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={timeZone}
              onChange={(e) => setTZEverywhere(e.target.value)}
              className="rn-header-pill h-9 min-w-0 w-[104px] shrink px-2 text-[11px] font-semibold"
              title={tr("timezoneTitle")}
              aria-label={tr("timezoneTitle")}
            >
              {timeZoneOptions.map((option) => (
                <option key={option.value} className="text-black" value={option.value}>
                  {option.short}
                </option>
              ))}
            </select>

            {showTabs && tab && setTab ? (
              <div className="rn-header-pill inline-flex h-9 min-w-0 flex-1 overflow-hidden">
                <button
                  onClick={() => setTab("ALL")}
                  className={`min-w-0 flex-1 px-2 text-xs font-semibold transition ${
                    tab === "ALL" ? "bg-emerald-300 text-black" : "rn-text-primary hover:bg-white/10"
                  }`}
                >
                  {tr("all")}
                </button>
                <button
                  onClick={() => setTab("LIVE")}
                  className={`min-w-0 flex-1 px-2 text-xs font-semibold transition ${
                    tab === "LIVE" ? "bg-red-500 text-white" : "rn-text-primary hover:bg-white/10"
                  }`}
                >
                  {tr("live")}
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="rn-header-card flex min-w-0 flex-1 items-center justify-between px-3 py-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] rn-text-muted">{tr("today")}</div>
                <div className="truncate text-sm font-extrabold rn-text-primary">
                  {mounted && now ? formatTodayTZ(now, timeZone, effectiveLang) : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] rn-text-muted">{tr("time")}</div>
                <div className="text-sm font-extrabold tabular-nums rn-text-primary">
                  {mounted && now ? formatClockTZ(now, timeZone, effectiveLang) : "--:--"}
                  <span className="ml-1 text-[11px] font-black rn-text-muted">
                    {mounted && now ? formatSecondsTZ(now, timeZone, effectiveLang) : "--"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
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
                    key={`mobile-${option.value}`}
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
        </div>

        <div className="mt-3 hidden flex-col gap-3 md:flex md:flex-row md:items-center">
          <div className="relative flex h-9 w-full flex-nowrap items-center gap-2 overflow-x-auto pr-16 [-webkit-overflow-scrolling:touch]">
            <div className="rn-header-pill inline-flex h-9 shrink-0 items-center gap-2 px-3">
              <LanguageChip option={currentLanguage} />
              <select
                value={effectiveLang}
                onChange={(e) => setLanguageEverywhere(e.target.value as Lang)}
                className="h-9 cursor-pointer bg-transparent text-xs font-semibold rn-text-primary outline-none sm:text-sm"
                aria-label={tr("language")}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} className="text-black" value={option.value}>
                    {option.short}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={timeZone}
              onChange={(e) => setTZEverywhere(e.target.value)}
              className="rn-header-pill h-9 w-[140px] shrink-0 px-2 text-xs sm:w-auto sm:text-sm"
              title={tr("timezoneTitle")}
            >
              {timeZoneOptions.map((option) => (
                <option key={option.value} className="text-black" value={option.value}>
                  {option.long}
                </option>
              ))}
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
                {mounted && now ? formatTodayTZ(now, timeZone, effectiveLang) : ""}
              </div>
            </div>

            <div className="rn-header-card flex h-[56px] w-[190px] flex-col justify-center px-4 py-2">
              <div className="text-[11px] font-semibold rn-text-muted">{tr("time")}</div>
              <div className="mt-1 text-base font-extrabold leading-tight tabular-nums">
                {mounted && now ? formatClockTZ(now, timeZone, effectiveLang) : "--:--"}
                <span className="ml-1 text-sm font-black rn-text-muted">
                  {mounted && now ? formatSecondsTZ(now, timeZone, effectiveLang) : "--"}
                </span>
              </div>
            </div>
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
