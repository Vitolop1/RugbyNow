"use client";

import AppHeader from "@/app/components/AppHeader";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

export default function PrivacyPage() {
  const { lang } = usePrefs();
  const tr = (key: string) => t(lang, key);

  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold">{tr("privacyTitle")}</h1>

        <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
          <p>{tr("privacyBody1")}</p>
          <p>{tr("privacyBody2")}</p>
          <p>{tr("privacyBody3")}</p>
          <p>
            {tr("contact")}:{" "}
            <a className="underline" href="mailto:lopresttivito@gmail.com">
              lopresttivito@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
