"use client";

import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

export default function LoadingScreen() {
  const { lang } = usePrefs();

  return (
    <div className="rn-app-bg flex min-h-screen items-center justify-center">
      <div className="text-sm text-white/80">{t(lang, "loadingSite")}</div>
    </div>
  );
}
