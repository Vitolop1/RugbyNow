"use client";

import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { t } from "@/lib/i18n";
import { usePrefs } from "@/lib/usePrefs";

const POSTS = [
  {
    slug: "week-1",
    date: "2026-02-26",
  },
];

export default function WeeklyPage() {
  const { lang } = usePrefs();
  const tr = (key: string) => t(lang, key);

  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold">{tr("weeklyTitle")}</h1>
        <p className="mt-3 text-white/80">{tr("weeklyBody")}</p>

        <div className="mt-8 space-y-3">
          {POSTS.map((post) => (
            <Link
              key={post.slug}
              href={`/weekly/${post.slug}`}
              className="block rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:bg-black/30"
            >
              <div className="text-sm text-white/60">{post.date}</div>
              <div className="mt-1 text-xl font-extrabold">{tr("week1Title")}</div>
              <div className="mt-2 text-white/80">{tr("week1Excerpt")}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
