"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { usePrefs, type Lang } from "@/lib/usePrefs";

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
  const [logoOk, setLogoOk] = useState(true);

  const now = useMemo(() => (nowTick != null ? new Date(nowTick) : null), [nowTick]);
  const effectiveLang = langProp ?? lang;
  const tr = (key: string) => t(effectiveLang, key);

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

  const centerTitle = title ? (
    <div className="select-none text-center text-white">
      <div className="min-w-0">
        <div className="truncate text-[18px] font-extrabold sm:text-[22px]">{title}</div>
        {subtitle ? <div className="truncate text-[11px] text-white/75">{subtitle}</div> : null}
      </div>
    </div>
  ) : (
    <Link href="/" className="block select-none text-center text-white">
      <h1 className="whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight sm:text-[26px]">
        Rugby<span className="text-emerald-300">Now</span>
      </h1>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B3E28]/80 backdrop-blur">
      <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6">
        <div className="relative flex items-center">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20 shadow sm:h-[54px] sm:w-[54px]">
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

          <div className="absolute left-1/2 max-w-[70%] -translate-x-1/2 sm:max-w-[80%]">{centerTitle}</div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/leagues"
              className="hidden h-9 items-center rounded-full border border-white/10 bg-black/20 px-3 text-xs font-extrabold text-white/90 hover:bg-black/30 sm:inline-flex"
            >
              {tr("leagues")}
            </Link>
            <Link
              href="/weekly"
              className="hidden h-9 items-center rounded-full border border-white/10 bg-black/20 px-3 text-xs font-extrabold text-white/90 hover:bg-black/30 sm:inline-flex"
            >
              {tr("weekly")}
            </Link>
            <Link
              href="/about"
              className="hidden h-9 items-center rounded-full border border-white/10 bg-black/20 px-3 text-xs font-extrabold text-white/90 hover:bg-black/30 sm:inline-flex"
            >
              {tr("about")}
            </Link>
            <div className="h-11 w-11 sm:hidden" />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex h-9 w-full flex-nowrap items-center gap-2 overflow-x-auto pr-12 [-webkit-overflow-scrolling:touch]">
            <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2">
              <span className="text-sm" aria-hidden="true">
                🌐
              </span>
              <select
                value={effectiveLang}
                onChange={(e) => setLanguageEverywhere(e.target.value as Lang)}
                className="h-9 cursor-pointer bg-transparent text-xs font-semibold text-white outline-none sm:text-sm"
                aria-label={tr("language")}
              >
                <option className="text-black" value="en">
                  🇺🇸 EN
                </option>
                <option className="text-black" value="es">
                  🇪🇸 ES
                </option>
                <option className="text-black" value="fr">
                  🇫🇷 FR
                </option>
                <option className="text-black" value="it">
                  🇮🇹 IT
                </option>
              </select>
            </div>

            <select
              value={timeZone}
              onChange={(e) => setTZEverywhere(e.target.value)}
              className="h-9 w-[140px] shrink-0 rounded-full border border-white/10 bg-black/20 px-2 text-xs text-white sm:w-auto sm:text-sm"
              title="Timezone"
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
              <div className="inline-flex h-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
                <button
                  onClick={() => setTab("ALL")}
                  className={`h-9 px-3 text-xs font-semibold transition sm:text-sm ${
                    tab === "ALL" ? "bg-emerald-300 text-black" : "text-white hover:bg-white/10"
                  }`}
                >
                  {tr("all")}
                </button>
                <button
                  onClick={() => setTab("LIVE")}
                  className={`h-9 px-3 text-xs font-semibold transition sm:text-sm ${
                    tab === "LIVE" ? "bg-red-500 text-white" : "text-white hover:bg-white/10"
                  }`}
                >
                  {tr("live")}
                </button>
              </div>
            ) : null}

            <button
              onClick={() => setThemeEverywhere(!dark)}
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-sm text-white hover:bg-white/10"
              title="Toggle theme"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>

          <div className="hidden items-center gap-3 md:ml-auto md:flex">
            <div className="flex h-[56px] w-[190px] flex-col justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-white">
              <div className="text-[11px] font-semibold text-white/70">{tr("today")}</div>
              <div className="mt-1 truncate text-base font-extrabold leading-tight">
                {mounted && now ? formatTodayTZ(now, timeZone) : ""}
              </div>
            </div>

            <div className="flex h-[56px] w-[190px] flex-col justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-white">
              <div className="text-[11px] font-semibold text-white/70">{tr("time")}</div>
              <div className="mt-1 text-base font-extrabold leading-tight tabular-nums">
                {mounted && now ? formatClockTZ(now, timeZone) : "--:--"}
                <span className="ml-1 text-sm font-black text-white/80">
                  {mounted && now ? formatSecondsTZ(now, timeZone) : "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-white/85 md:hidden">
            {mounted && now ? (
              <span className="font-semibold">
                {formatTodayTZ(now, timeZone)} • {formatClockTZ(now, timeZone)}:{formatSecondsTZ(now, timeZone)}
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
