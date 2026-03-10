"use client";

import { useEffect, useState } from "react";

export type Lang = "en" | "es" | "fr";

const DEFAULT_TZ = "America/New_York";

function readLang(): Lang {
  const v = localStorage.getItem("lang");
  return v === "en" || v === "es" || v === "fr" ? v : "en";
}

function readTZ(): string {
  const v = localStorage.getItem("tz");
  return v && v.trim() ? v : DEFAULT_TZ;
}

function readTheme(): boolean {
  return localStorage.getItem("theme") === "dark";
}

function getInitialTimeZone() {
  return typeof window === "undefined" ? DEFAULT_TZ : readTZ();
}

function getInitialLang(): Lang {
  return typeof window === "undefined" ? "en" : readLang();
}

function getInitialTheme() {
  return typeof window !== "undefined" && readTheme();
}

export function usePrefs() {
  const [timeZone, setTimeZone] = useState<string>(getInitialTimeZone);
  const [lang, setLang] = useState<Lang>(getInitialLang);
  const [dark, setDark] = useState<boolean>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.toggle("dark", readTheme());

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
