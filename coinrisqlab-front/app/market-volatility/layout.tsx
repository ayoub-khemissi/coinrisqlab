import { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Market Volatility",
  description:
    "Analyze real-time portfolio volatility for the top 40 cryptocurrencies. View annualized and daily volatility, risk contributors, diversification benefit, correlation data, and volatility distribution.",
  alternates: {
    canonical: `${siteConfig.siteUrl}/market-volatility`,
  },
  openGraph: {
    title: "Market Volatility | CoinRisqLab",
    description:
      "Comprehensive crypto portfolio volatility analysis with risk contributors, correlation data, and diversification metrics.",
    url: `${siteConfig.siteUrl}/market-volatility`,
    images: [
      {
        url: `/img/branding/1200x630.png`,
        width: 1200,
        height: 630,
        alt: "CoinRisqLab Market Volatility Analysis",
      },
    ],
  },
};

export default function MarketVolatilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
