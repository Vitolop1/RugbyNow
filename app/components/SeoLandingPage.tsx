import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";

type SeoLandingLink = {
  href: string;
  label: string;
  description: string;
};

export default function SeoLandingPage({
  title,
  description,
  intro,
  bullets,
  primaryLink,
  links,
}: {
  title: string;
  description: string;
  intro: string;
  bullets: string[];
  primaryLink: SeoLandingLink;
  links: SeoLandingLink[];
}) {
  return (
    <div className="rn-app-bg min-h-screen">
      <AppHeader subtitle={description} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur sm:p-8">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">{intro}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={primaryLink.href}
              className="rounded-full bg-emerald-300 px-5 py-2 text-sm font-extrabold text-black transition hover:bg-emerald-200"
            >
              {primaryLink.label}
            </Link>
          </div>

          <ul className="mt-6 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
            {bullets.map((bullet) => (
              <li key={bullet} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-extrabold text-white">Explore RugbyNow</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[primaryLink, ...links].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-white/10 bg-white/10 p-5 transition hover:bg-white/15"
              >
                <div className="text-base font-bold text-white">{link.label}</div>
                <p className="mt-2 text-sm leading-6 text-white/75">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
