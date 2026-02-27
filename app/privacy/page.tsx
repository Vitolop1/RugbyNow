export const metadata = {
  title: "Privacy Policy • RugbyNow",
  description: "Privacy policy for RugbyNow.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0E4F33] text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold">Privacy Policy</h1>

        <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-white/80">
          <p>
            RugbyNow is a scoreboard website. We do not require accounts and we do not collect personal information like
            name, address, or payment details.
          </p>

          <p>
            We may use standard analytics and advertising tools (e.g., cookies) to measure traffic and show ads. These
            services may collect basic usage data such as pages visited and device/browser information.
          </p>

          <p>
            If you want to opt out of personalized ads, you can do it through your Google Ads settings in your browser.
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