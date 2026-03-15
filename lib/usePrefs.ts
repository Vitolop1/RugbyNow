"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TZ, detectBrowserTimeZone, isValidTimeZone } from "@/lib/timeZones";

export type Lang = "en" | "es" | "fr" | "it";
export type ThemeMode = "rugby" | "light" | "dark";

const DEFAULT_LANG: Lang = "en";
const DEFAULT_THEME: ThemeMode = "rugby";

function readLang(): Lang {
  const v = localStorage.getItem("lang");
  return v === "en" || v === "es" || v === "fr" || v === "it" ? v : DEFAULT_LANG;
}

function readTZ(): string {
  const v = localStorage.getItem("tz");
  if (isValidTimeZone(v)) return v as string;
  return detectBrowserTimeZone() ?? DEFAULT_TZ;
}

function readTheme(): ThemeMode {
  const v = localStorage.getItem("theme");
  return v === "rugby" || v === "light" || v === "dark" ? v : DEFAULT_THEME;
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove("theme-rugby", "theme-light", "theme-dark", "dark");
  root.classList.add(`theme-${theme}`);
  if (theme === "dark") root.classList.add("dark");
}

export function usePrefs() {
  const [mounted, setMounted] = useState(false);
  const [timeZone, setTimeZone] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_TZ;
    return readTZ();
  });
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return DEFAULT_LANG;
    return readLang();
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return readTheme();
  });

  useEffect(() => {
    const mountId = window.requestAnimationFrame(() => setMounted(true));

    const syncPrefs = () => {
      const nextTZ = readTZ();
      const nextLang = readLang();
      const nextTheme = readTheme();
      const savedTZ = localStorage.getItem("tz");

      if (!isValidTimeZone(savedTZ) && isValidTimeZone(nextTZ)) {
        localStorage.setItem("tz", nextTZ);
      }

      setTimeZone(nextTZ);
      setLang(nextLang);
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    const syncId = window.setTimeout(syncPrefs, 0);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "tz") setTimeZone(readTZ());
      if (e.key === "lang") setLang(readLang());
      if (e.key === "theme") {
        const nextTheme = readTheme();
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }
    };

    const onTZ: EventListener = () => setTimeZone(readTZ());
    const onLang: EventListener = () => setLang(readLang());
    const onTheme: EventListener = () => {
      const nextTheme = readTheme();
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("tz-change", onTZ);
    window.addEventListener("lang-change", onLang);
    window.addEventListener("theme-change", onTheme);

    return () => {
      window.cancelAnimationFrame(mountId);
      window.clearTimeout(syncId);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tz-change", onTZ);
      window.removeEventListener("lang-change", onLang);
      window.removeEventListener("theme-change", onTheme);
    };
  }, []);

  const setTZEverywhere = (tz: string) => {
    const nextTZ = isValidTimeZone(tz) ? tz : detectBrowserTimeZone() ?? DEFAULT_TZ;
    localStorage.setItem("tz", nextTZ);
    setTimeZone(nextTZ);
    window.dispatchEvent(new Event("tz-change"));
  };

  const setLangEverywhere = (nextLang: Lang) => {
    localStorage.setItem("lang", nextLang);
    setLang(nextLang);
    window.dispatchEvent(new Event("lang-change"));
  };

  const setThemeEverywhere = (nextTheme: ThemeMode) => {
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event("theme-change"));
  };

  return {
    mounted,
    timeZone,
    setTZEverywhere,
    lang,
    setLangEverywhere,
    theme,
    dark: theme === "dark",
    setThemeEverywhere,
  };
}
