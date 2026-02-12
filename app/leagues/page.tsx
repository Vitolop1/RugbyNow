"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type League = {
  id: number;
  name: string;
  slug: string;
  region: string | null;
};

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("competitions")
        .select("id, name, slug, region")
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setLeagues([]);
      } else {
        setLeagues((data || []) as League[]);
      }

      setLoading(false);
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">Leagues</h1>
        <p className="text-sm text-neutral-600 dark:text-white/60 mt-1">
          Pick a competition to see fixtures by date.
        </p>

        {loading ? (
          <div className="mt-6 text-neutral-600 dark:text-white/60">Loading...</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/leagues/${l.slug}`}
                className="rounded-2xl border border-neutral-200 dark:border-white/10 p-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition"
              >
                <div className="font-semibold">{l.name}</div>
                <div className="text-xs text-neutral-600 dark:text-white/60 mt-1">
                  {l.region || "—"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
