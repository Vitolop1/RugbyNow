"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AppHeader from "@/app/components/AppHeader";

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
    <div className="min-h-screen relative overflow-hidden bg-[#0E4F33] text-white">
      {/* Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-green-300/10 blur-3xl" />
      </div>

      <AppHeader subtitle="Pick a competition" />

      <div className="relative mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">Leagues</h1>
        <p className="text-sm text-white/80 mt-1">Pick a competition to see fixtures by date.</p>

        {loading ? (
          <div className="mt-6 text-white/80">Loading...</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/leagues/${l.slug}`}
                className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur p-4 hover:bg-white/15 transition"
              >
                <div className="font-semibold">{l.name}</div>
                <div className="text-xs text-white/75 mt-1">{l.region || "—"}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}