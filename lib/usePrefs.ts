"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type Lang = "en" | "es" | "fr" | "it";

const DEFAULT_TZ = "America/New_York";
const DEFAULT_LANG: Lang = "en";
const DEFAULT_DARK = false;

function readLang(): Lang {
  const v = localStorage.getItem("lang");
  return v === "en" || v === "es" || v === "fr" || v === "it" ? v : "en";
}

function readTZ(): string {
  const v = localStorage.getItem("tz");
  return v && v.trim() ? v : DEFAULT_TZ;
}

function readTheme(): boolean {
  return localStorage.getItem("theme") === "dark";
}

export function usePrefs() {
  const [timeZone, setTimeZone] = useState<string>(DEFAULT_TZ);
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [dark, setDark] = useState<boolean>(DEFAULT_DARK);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    const syncPrefs = () => {
      const nextTZ = readTZ();
      const nextLang = readLang();
      const nextDark = readTheme();

      setTimeZone(nextTZ);
      setLang(nextLang);
      setDark(nextDark);
      document.documentElement.classList.toggle("dark", nextDark);
    };

    const syncId = window.setTimeout(syncPrefs, 0);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "tz") setTimeZone(readTZ());
      if (e.key === "lang") setLang(readLang());
      if (e.key === "theme") {
        const nextDark = readTheme();
        setDark(nextDark);
        document.documentElement.classList.toggle("dark", nextDark);
      }
    };

    const onTZ: EventListener = () => setTimeZone(readTZ());
    const onLang: EventListener = () => setLang(readLang());
    const onTheme: EventListener = () => {
      const nextDark = readTheme();
      setDark(nextDark);
      document.documentElement.classList.toggle("dark", nextDark);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("tz-change", onTZ);
    window.addEventListener("lang-change", onLang);
    window.addEventListener("theme-change", onTheme);

    return () => {
      window.clearTimeout(syncId);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tz-change", onTZ);
      window.removeEventListener("lang-change", onLang);
      window.removeEventListener("theme-change", onTheme);
    };
  }, []);

  const setTZEverywhere = (tz: string) => {
    localStorage.setItem("tz", tz);
    setTimeZone(tz);
    window.dispatchEvent(new Event("tz-change"));
  };

  const setLangEverywhere = (nextLang: Lang) => {
    localStorage.setItem("lang", nextLang);
    setLang(nextLang);
    window.dispatchEvent(new Event("lang-change"));
  };

  const setThemeEverywhere = (nextDark: boolean) => {
    localStorage.setItem("theme", nextDark ? "dark" : "light");
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    window.dispatchEvent(new Event("theme-change"));
  };

  return {
    mounted,
    timeZone,
    setTZEverywhere,
    lang,
    setLangEverywhere,
    dark,
    setThemeEverywhere,
  };
}
