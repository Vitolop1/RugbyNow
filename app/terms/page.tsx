export const metadata = {
  title: "Terms • RugbyNow",
  description: "Terms of use for RugbyNow.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold">Terms of Use</h1>

        <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
          <p>
            RugbyNow is provided “as is” without warranties. We try to keep results and standings accurate, but data may
            occasionally be delayed or incorrect.
          </p>

          <p>
            You may use RugbyNow for personal, non-commercial use. You may not copy or redistribute large portions of the
            content automatically.
          </p>

          <p>
            Contact:{" "}
            <a className="underline" href="mailto:lopresttivito@gmail.com">
              lopresttivito@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}