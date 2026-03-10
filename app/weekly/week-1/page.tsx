"use client";

import AppHeader from "@/app/components/AppHeader";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

export default function Week1Post() {
  const { lang } = usePrefs();
  const tr = (key: string) => t(lang, key);

  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold">{tr("week1Title")}</h1>
        <p className="mt-2 text-white/60">2026-02-26</p>

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
          <p>{tr("week1Body1")}</p>
          <p>{tr("week1Body2")}</p>
          <p>{tr("week1Body3")}</p>
        </div>
      </div>
    </div>
  );
}
