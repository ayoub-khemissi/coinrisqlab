import { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "CoinRisqLab 80 Index",
  description:
    "Track the CoinRisqLab 80 Index, a market-cap weighted index of the top 80 cryptocurrencies. View real-time index level, historical performance, constituent weights, and 24h/7d/30d charts.",
  alternates: {
    canonical: `${siteConfig.siteUrl}/index-coinrisqlab`,
  },
  openGraph: {
    title: "CoinRisqLab 80 Index | CoinRisqLab",
    description:
      "Market-cap weighted cryptocurrency index tracking the top 80 digital assets with real-time performance data.",
    url: `${siteConfig.siteUrl}/index-coinrisqlab`,
    images: [
      {
        url: `/img/branding/1200x630.png`,
        width: 1200,
        height: 630,
        alt: "CoinRisqLab 80 Index",
      },
    ],
  },
};

export default function IndexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
