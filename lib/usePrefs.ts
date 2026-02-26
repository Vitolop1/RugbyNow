// lib/usePrefs.ts
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

export function usePrefs() {
  const [timeZone, setTimeZone] = useState<string>(DEFAULT_TZ);
  const [lang, setLang] = useState<Lang>("en");
  const [dark, setDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // init + listeners
  useEffect(() => {
    setMounted(true);

    setTimeZone(readTZ());
    setLang(readLang());
    setDark(readTheme());
    document.documentElement.classList.toggle("dark", readTheme());

    const onStorage = (e: StorageEvent) => {
      if (e.key === "tz") setTimeZone(readTZ());
      if (e.key === "lang") setLang(readLang());
      if (e.key === "theme") {
        const d = readTheme();
        setDark(d);
        document.documentElement.classList.toggle("dark", d);
      }
    };
    window.addEventListener("storage", onStorage);

    const onTZ = () => setTimeZone(readTZ());
    const onLang = () => setLang(readLang());
    const onTheme = () => {
      const d = readTheme();
      setDark(d);
      document.documentElement.classList.toggle("dark", d);
    };

    window.addEventListener("tz-change", onTZ as any);
    window.addEventListener("lang-change", onLang as any);
    window.addEventListener("theme-change", onTheme as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("tz-change", onTZ as any);
      window.removeEventListener("lang-change", onLang as any);
      window.removeEventListener("theme-change", onTheme as any);
    };
  }, []);

  // setters “globales”
  const setTZEverywhere = (tz: string) => {
    localStorage.setItem("tz", tz);
    setTimeZone(tz);
    window.dispatchEvent(new Event("tz-change"));
  };

  const setLangEverywhere = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLang(l);
    window.dispatchEvent(new Event("lang-change"));
  };

  const setThemeEverywhere = (d: boolean) => {
    localStorage.setItem("theme", d ? "dark" : "light");
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
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