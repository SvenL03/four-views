import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/reveal";
import "./globals.css";

const serif = Source_Serif_4({
  variable: "--font-text",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const sans = Source_Sans_3({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Four Views: one question, four Christian traditions",
    template: "%s",
  },
  description:
    "A theological question set out the way four American Christian traditions answer it, each in its own words and from its own documents, with the sources.",
  applicationName: "Four Views",
  authors: [{ name: "Sven Loeffler" }],
  openGraph: { siteName: "Four Views", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#16171a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <a
          href="#main"
          className="ui sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Reveal />
      </body>
    </html>
  );
}
