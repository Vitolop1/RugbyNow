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

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="text-xl font-extrabold">{tr("aboutData")}</h2>
            <p className="mt-3 text-white/80">{tr("aboutDataBody")}</p>
            <p className="mt-3 text-white/75">{tr("aboutDataExtra")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
              <h2 className="text-xl font-extrabold text-white">{tr("aboutCoverageTitle")}</h2>
              <p className="mt-3 text-white/80">{tr("aboutCoverageBody")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
              <h2 className="text-xl font-extrabold text-white">{tr("aboutStackTitle")}</h2>
              <p className="mt-3 text-white/80">{tr("aboutStackBody")}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="text-xl font-extrabold text-white">{tr("aboutProfilesTitle")}</h2>
            <p className="mt-3 text-white/80">{tr("aboutProfilesBody")}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="text-xl font-extrabold">{tr("aboutContact")}</h2>
            <p className="mt-3 text-white/80">
              {tr("contact")}:{" "}
              <a className="underline" href="mailto:lopresttivito@gmail.com">
                lopresttivito@gmail.com
              </a>
            </p>
            <p className="mt-3 text-white/75">{tr("aboutContactExtra")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
