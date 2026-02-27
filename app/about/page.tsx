export const metadata = {
  title: "About • RugbyNow",
  description: "What RugbyNow is and how it works.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold">About RugbyNow</h1>
        <p className="mt-3 text-white/80">
          RugbyNow is a fast, clean rugby scoreboard focused on fixtures, live matches, results, and standings — built to
          be simple and easy to read on any device.
        </p>

        <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6">
          <h2 className="text-xl font-extrabold">Data & updates</h2>
          <p className="text-white/80">
            Matches and standings are updated automatically. If you notice an issue (wrong team name, missing match, etc.)
            please reach out and I’ll fix it.
          </p>

          <h2 className="text-xl font-extrabold pt-2">Contact</h2>
          <p className="text-white/80">
            Email:{" "}
            <a className="underline" href="mailto:lopresttivito@gmail.com">
              lopresttivito@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}