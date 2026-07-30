import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Toaster } from "@/components/ui/sonner";
import { absoluteUrl, getSiteOrigin, SITE_NAME } from "@/lib/site-config";
import { Analytics } from "@vercel/analytics/next";
import { JsonLd } from "@/components/JsonLd";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "sports",
  title: {
    default: "SquadStat - Football Form, Value & Injury Analytics",
    template: "%s | SquadStat",
  },
  description:
    "Track football team form, injuries, and player performance across Europe's top 5 leagues. Analyze Premier League, La Liga, Bundesliga, Serie A, and Ligue 1 with real-time Transfermarkt data.",
  keywords: [
    "football analytics",
    "soccer statistics",
    "soccer analytics",
    "team form tracker",
    "Premier League stats",
    "La Liga stats",
    "Bundesliga stats",
    "Serie A stats",
    "Ligue 1 stats",
    "Transfermarkt data",
    "football injuries",
    "player stats",
    "football value analysis",
    "expected position football",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SquadStat - Football Form, Value & Injury Analytics",
    description:
      "Form swings, value gaps, player output & injury cost across Europe's top 5 leagues.",
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    url: absoluteUrl("/"),
  },
  twitter: {
    card: "summary_large_image",
    title: "SquadStat - Football Form, Value & Injury Analytics",
    description:
      "Form swings, value gaps, player output & injury cost across Europe's top 5 leagues.",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: getSiteOrigin(),
        description:
          "Track football team form, injuries, and player performance across Europe's top 5 leagues.",
      },
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: getSiteOrigin(),
        logo: absoluteUrl("/icon.png"),
      },
    ],
  };

  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable} antialiased bg-neutral-950 text-neutral-100 min-h-screen flex flex-col`}
      >
        <JsonLd data={jsonLd} />
        <Providers>
          <Header />
          <main className="page-container flex-1">{children}</main>
          <Footer />
          <Toaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
