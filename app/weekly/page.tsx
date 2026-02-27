import Link from "next/link";

export const metadata = {
  title: "This Week in Rugby • RugbyNow",
  description: "Weekly rugby highlights, fixtures, and notes.",
};

const POSTS = [
  {
    slug: "week-1",
    title: "Week 1: What to watch",
    date: "2026-02-26",
    excerpt: "Key fixtures and quick notes for the week.",
  },
];

export default function WeeklyPage() {
  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold">This Week in Rugby</h1>
        <p className="mt-3 text-white/80">
          Short weekly posts with what matters: big matches, table pressure, and quick takes.
        </p>

        <div className="mt-8 space-y-3">
          {POSTS.map((p) => (
            <Link
              key={p.slug}
              href={`/weekly/${p.slug}`}
              className="block rounded-2xl border border-white/10 bg-black/20 p-5 hover:bg-black/30 transition"
            >
              <div className="text-sm text-white/60">{p.date}</div>
              <div className="text-xl font-extrabold mt-1">{p.title}</div>
              <div className="text-white/80 mt-2">{p.excerpt}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}