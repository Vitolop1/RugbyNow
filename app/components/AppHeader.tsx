"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  title?: React.ReactNode;
  subtitle?: string;
  showTabs?: boolean;
  tab?: "ALL" | "LIVE";
  setTab?: (t: "ALL" | "LIVE") => void;
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

export default function AppHeader({ title, subtitle, showTabs, tab, setTab }: Props) {
  const [dark, setDark] = useState(false);

  const [timeZone, setTimeZone] = useState<string>("America/New_York");
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const now = useMemo(() => new Date(nowTick), [nowTick]);

  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    setDark(saved === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem("tz");
    if (saved) setTimeZone(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("tz", timeZone);
    window.dispatchEvent(new Event("tz-change"));
  }, [timeZone]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-black">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
        {/* BRAND: click logo o texto -> HOME */}
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl shadow overflow-hidden bg-white/80 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 flex items-center justify-center">
            {logoOk ? (
              <Image
                src="/logo.jpg"
                alt="RugbyNow logo"
                width={36}
                height={36}
                className="h-9 w-9 object-cover"
                onError={() => setLogoOk(false)}
                priority
              />
            ) : (
              <span className="text-xs font-black">RN</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-xl font-extrabold tracking-tight truncate">
              {title ?? (
                <>
                  Rugby<span className="text-emerald-600 dark:text-emerald-400">Now</span>
                </>
              )}
            </div>
            <div className="text-xs text-neutral-600 dark:text-white/60 truncate">
              {subtitle ?? "Live scores • Fixtures • Tables"}
            </div>
          </div>
        </Link>

        {/* CONTROLS */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="hidden sm:block text-sm font-extrabold text-neutral-800 dark:text-white">
            TODAY: <span className="ml-1">{formatTodayTZ(now, timeZone)}</span>
          </div>

          <div className="px-3 py-2 rounded-2xl border bg-white/80 border-neutral-200 dark:bg-neutral-900 dark:border-white/10">
            <div className="text-[11px] leading-none text-neutral-600 dark:text-white/60">Time</div>
            <div className="text-lg font-extrabold tabular-nums leading-tight">
              {formatClockTZ(now, timeZone)}
              <span className="ml-2 text-sm font-black opacity-80">{formatSecondsTZ(now, timeZone)}</span>
            </div>
          </div>

          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="px-3 py-2 rounded-full text-sm border transition
              bg-white/80 border-neutral-200 hover:bg-white
              dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
            title="Timezone"
          >
            <option value="America/New_York">New York (ET)</option>
            <option value="America/Chicago">Chicago (CT)</option>
            <option value="America/Denver">Denver (MT)</option>
            <option value="America/Los_Angeles">Los Angeles (PT)</option>
            <option value="America/Argentina/Buenos_Aires">Argentina (ART)</option>
            <option value="Europe/London">London (GMT)</option>
          </select>

          {showTabs && tab && setTab ? (
            <>
              <button
                onClick={() => setTab("ALL")}
                className={`px-3 py-2 rounded-full text-sm border transition ${
                  tab === "ALL"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                }`}
              >
                All
              </button>

              <button
                onClick={() => setTab("LIVE")}
                className={`px-3 py-2 rounded-full text-sm border transition ${
                  tab === "LIVE"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white/80 border-neutral-200 hover:bg-white dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
                }`}
              >
                Live
              </button>
            </>
          ) : null}

          <button
            onClick={() => setDark((v) => !v)}
            className="px-3 py-2 rounded-full text-sm border transition
              bg-white/80 border-neutral-200 hover:bg-white
              dark:bg-neutral-900 dark:border-white/10 dark:hover:bg-neutral-800"
            title="Toggle theme"
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
