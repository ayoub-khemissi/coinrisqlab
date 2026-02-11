import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";
import Link from "next/link";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import JsonLd from "@/components/json-ld";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "CoinRisqLab | Real-time Crypto Analytics",
    template: "%s | CoinRisqLab",
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: siteConfig.authors,
  creator: siteConfig.creator,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.siteUrl,
    title: "CoinRisqLab | Real-time Crypto Analytics",
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: `/img/branding/1200x630.png`,
        width: 1200,
        height: 630,
        alt: "CoinRisqLab - Real-time crypto market intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CoinRisqLab | Real-time Crypto Analytics",
    description: siteConfig.description,
    creator: "@coinrisqlab",
    images: [`/img/branding/1200x630.png`],
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
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        suppressHydrationWarning
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <div className="relative flex flex-col h-screen">
            <Navbar />
            <main className="container mx-auto max-w-7xl p-6 flex-grow">
              {children}
            </main>
            <footer className="w-full flex flex-col items-center justify-center py-6 gap-4 border-t border-default-100 mt-8">
              <div className="flex flex-col md:flex-row gap-3 md:gap-6 text-sm text-default-600 w-full md:w-auto px-6 md:px-0 md:justify-center">
                <Link className="hover:text-primary transition-colors" href="/">
                  Home
                </Link>
                <Link
                  className="hover:text-primary transition-colors"
                  href="/index-coinrisqlab"
                >
                  CoinRisqLab 80 Index
                </Link>
                <Link
                  className="hover:text-primary transition-colors"
                  href="/portfolio-risk"
                >
                  Portfolio Risk
                </Link>
                <Link
                  className="hover:text-primary transition-colors"
                  href="/methodology"
                >
                  Methodology
                </Link>
              </div>
              <p className="text-default-500 text-xs">
                © {new Date().getFullYear()} CoinRisqLab. All rights reserved.
              </p>
            </footer>
          </div>
          <JsonLd />
        </Providers>
      </body>
    </html>
  );
}
