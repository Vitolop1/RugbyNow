"use client";

import AppHeader from "@/app/components/AppHeader";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

export default function AboutPage() {
  const { lang } = usePrefs();
  const tr = (key: string) => t(lang, key);

  return (
    <div className="rn-app-bg min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold">{tr("aboutTitle")}</h1>
        <p className="mt-3 text-white/80">{tr("aboutBody")}</p>

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="text-xl font-extrabold">{tr("aboutData")}</h2>
          <p className="text-white/80">{tr("aboutDataBody")}</p>

          <h2 className="pt-2 text-xl font-extrabold">{tr("aboutContact")}</h2>
          <p className="text-white/80">
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
