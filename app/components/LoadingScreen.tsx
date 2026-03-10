"use client";

import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

export default function LoadingScreen() {
  const { lang } = usePrefs();

  return (
    <div className="min-h-screen bg-[#0E4F33] text-white flex items-center justify-center">
      <div className="text-sm text-white/80">{t(lang, "loadingSite")}</div>
    </div>
  );
}
