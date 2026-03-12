import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RugbyNow",
  description: "Live rugby scores, fixtures, and tables",
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
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4088690490762441"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} rn-app-bg min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
