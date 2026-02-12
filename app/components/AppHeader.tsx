"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type Lang = "en" | "es" | "fr";

type Props = {
  title?: React.ReactNode;
  subtitle?: string;
  showTabs?: boolean;
  tab?: "ALL" | "LIVE";
  setTab?: (t: "ALL" | "LIVE") => void;

  // opcional: si alguna página quiere controlar el idioma desde afuera
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

function readLangFromStorage(): Lang {
  const v = localStorage.getItem("lang");
  return v === "en" || v === "es" || v === "fr" ? (v as Lang) : "en";
}

export default function AppHeader({ title, subtitle, showTabs, tab, setTab, lang, onLangChange }: Props) {
  const [dark, setDark] = useState(false);

  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const now = useMemo(() => new Date(nowTick), [nowTick]);

  const [logoOk, setLogoOk] = useState(true);

  // idioma interno (si no te pasan props)
  const [langLocal, setLangLocal] = useState<Lang>("en");
  const effectiveLang = lang ?? langLocal;

  // THEME
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  // TZ
  useEffect(() => {
    const saved = localStorage.getItem("tz");
    if (saved) setTimeZone(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("tz", timeZone);
    window.dispatchEvent(new Event("tz-change"));
  }, [timeZone]);

  // LANG: init + sync
  useEffect(() => {
    setLangLocal(readLangFromStorage());

    const onStorage = (e: StorageEvent) => {
      if (e.key === "lang" && e.newValue) {
        const v = e.newValue;
        if (v === "en" || v === "es" || v === "fr") setLangLocal(v);
      }
    };
    window.addEventListener("storage", onStorage);

    const onLangEvent = () => setLangLocal(readLangFromStorage());
    window.addEventListener("lang-change", onLangEvent as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("lang-change", onLangEvent as any);
    };
  }, []);

  // CLOCK
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const setLanguageEverywhere = (next: Lang) => {
    // si la página quiere controlarlo, respetamos eso
    if (onLangChange) onLangChange(next);

    // y siempre lo guardamos global para que afecte a toda la app
    localStorage.setItem("lang", next);
    setLangLocal(next);
    window.dispatchEvent(new Event("lang-change"));
  };

return (
  <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black">
    <div className="mx-auto max-w-7xl px-6 py-4 grid grid-cols-3 items-center gap-4">
      {/* LEFT: Logo + Language + Timezone */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="h-12 w-12 rounded-xl shadow overflow-hidden bg-white/80 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 flex items-center justify-center">
            {logoOk ? (
              <Image
                src="/logo.jpg"
                alt="RugbyNow logo"
                width={48}
                height={48}
                className="h-12 w-12 object-cover"
                onError={() => setLogoOk(false)}
                priority
              />
            ) : (
              <span className="text-xs font-black">RN</span>
            )}
          </div>
        </Link>

        {/* Language selector */}
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5 shrink-0">
          <span className="text-sm" aria-hidden="true">🌐</span>
          <select
            value={effectiveLang}
            onChange={(e) => setLanguageEverywhere(e.target.value as Lang)}
            className="bg-transparent text-sm font-semibold outline-none cursor-pointer text-neutral-900 dark:text-white"
            aria-label="Select language"
          >
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
          </select>
        </div>

        {/* Timezone (moved LEFT) */}
        <select
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          className="px-3 py-2 rounded-full text-sm border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10 shrink-0"
          title="Timezone"
        >
          <option value="America/New_York">New York (ET)</option>
          <option value="America/Chicago">Chicago (CT)</option>
          <option value="America/Denver">Denver (MT)</option>
          <option value="America/Los_Angeles">Los Angeles (PT)</option>
          <option value="America/Argentina/Buenos_Aires">Argentina (ART)</option>
          <option value="Europe/London">London (GMT)</option>
        </select>
      </div>

      {/* CENTER: BIG TITLE */}
      <div className="flex justify-center min-w-0">
        <Link href="/" className="select-none">
          <h1 className="text-[36px] leading-none font-extrabold tracking-tight whitespace-nowrap">
            Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
          </h1>
        </Link>
      </div>

      {/* RIGHT: Time boxes + Theme */}
{/* RIGHT: Time boxes + Theme */}
<div className="flex items-center justify-end gap-3 whitespace-nowrap">

  {/* today box */}
  <div className="w-[180px] h-[60px] px-4 py-2 rounded-2xl border 
    bg-white/80 border-neutral-200 
    dark:bg-neutral-900 dark:border-white/10
    flex flex-col justify-center">
    
    <div className="text-[11px] font-semibold text-neutral-600 dark:text-white/60 ">
      Today
    </div>

    <div className="mt-1 text-base font-extrabold leading-tight truncate">
      {formatTodayTZ(now, timeZone)}
    </div>
  </div>

  {/* time box */}
  <div className="w-[180px] h-[60px] px-4 py-2 rounded-2xl border 
    bg-white/80 border-neutral-200 
    dark:bg-neutral-900 dark:border-white/10
    flex flex-col justify-center">

    <div className="text-[11px] font-semibold text-neutral-600 dark:text-white/60 ">
      Time
    </div>

    <div className="mt-1 text-base font-extrabold tabular-nums leading-tight">
      {formatClockTZ(now, timeZone)}
      <span className="ml-1 text-sm font-black opacity-80">
        {formatSecondsTZ(now, timeZone)}
      </span>
    </div>
  </div>

  {/* Theme */}
  <button
    onClick={() => setDark((v) => !v)}
    className="px-3 py-2 rounded-full text-sm border 
      bg-white/80 border-neutral-200 
      dark:bg-neutral-900 dark:border-white/10"
    title="Toggle theme"
  >
    {dark ? "☀️" : "🌙"}
  </button>

</div>


    </div>
  </header>
);








}
