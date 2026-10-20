import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import GoogleAnalyticsPageview from "@/app/components/GoogleAnalyticsPageview";
import AppearanceSync from "@/app/components/AppearanceSync";
import {AD_PUBLISHER} from "@/lib/advertising";
import { getSiteUrl } from "@/lib/site";
import { readRuntimeEnv } from "@/lib/runtimeEnv";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();
const googleSiteVerification = readRuntimeEnv("GOOGLE_SITE_VERIFICATION");
// Public measurement ID verified in the owner's rugby-now.com web stream.
const googleAnalyticsId = readRuntimeEnv("NEXT_PUBLIC_GA_ID") ?? "G-FXNKQ0MK41";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RugbyNow",
    template: "RugbyNow | %s",
  },
  description:
    "Live rugby scores, fixtures, tables, standings, weekly recaps, and competition coverage from RugbyNow.",
  applicationName: "RugbyNow",
  other: {"google-adsense-account":AD_PUBLISHER},
  keywords: [
    "rugby",
    "rugby scores",
    "rugby fixtures",
    "rugby standings",
    "super rugby pacific",
    "six nations",
    "urba top 14",
    "rugby world cup",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "RugbyNow",
    description:
      "Live rugby scores, fixtures, tables, standings, weekly recaps, and competition coverage from RugbyNow.",
    siteName: "RugbyNow",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "RugbyNow",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RugbyNow",
    description:
      "Live rugby scores, fixtures, tables, standings, weekly recaps, and competition coverage from RugbyNow.",
    images: ["/logo.png"],
  },
  verification: googleSiteVerification
    ? {
        google: googleSiteVerification,
      }
    : undefined,
};

const themeInitScript = `
(() => {
  try {
    const saved = localStorage.getItem("theme");
    const nextTheme = saved === "light" || saved === "dark" || saved === "rugby" ? saved : "rugby";
    const root = document.documentElement;
    root.classList.remove("theme-rugby", "theme-light", "theme-dark", "dark");
    root.classList.add("theme-" + nextTheme);
    if (nextTheme === "dark") root.classList.add("dark");
    const appearance=JSON.parse(localStorage.getItem("rn:personalization")||"{}");
    root.dataset.rnDensity=appearance?.density==="comfortable"?"comfortable":"compact";
    root.dataset.rnTextSize=appearance?.textSize==="large"?"large":"standard";
    root.style.setProperty("--rn-font-scale",appearance?.textSize==="large"?"1.15":"1");
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="theme-rugby">
      <head>
        <script id="theme-init" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Script
          id="adsense-loader"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_PUBLISHER}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} rn-app-bg rn-compact min-h-screen antialiased`}
      >
        <AppearanceSync />
        {googleAnalyticsId ? <GoogleAnalyticsPageview measurementId={googleAnalyticsId} /> : null}
        {children}
      </body>
    </html>
  );
}
