export const metadata = {
  title: "Week 1 • This Week in Rugby • RugbyNow",
  description: "Key fixtures and quick notes for the week.",
};

export default function Week1Post() {
  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold">Week 1: What to watch</h1>
        <p className="mt-2 text-white/60">2026-02-26</p>

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
          <p>
            • Big matches to watch: pick 2–3 fixtures you care about and add them here.
          </p>
          <p>
            • Standings pressure: who can jump positions this round?
          </p>
          <p>
            • Notes: injuries, rivalries, derby games, etc.
          </p>
        </div>
      </div>
    </div>
  );
}