import { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Transparent methodology behind CoinRisqLab analytics: index calculation, volatility measurement, and risk metrics (VaR, CVaR, Beta, Alpha, Sharpe Ratio, Skewness, Kurtosis).",
  alternates: {
    canonical: `${siteConfig.siteUrl}/methodology`,
  },
  openGraph: {
    title: "Methodology | CoinRisqLab",
    description:
      "Learn how CoinRisqLab calculates its crypto index, portfolio volatility, and comprehensive risk metrics.",
    url: `${siteConfig.siteUrl}/methodology`,
    images: [
      {
        url: `/img/branding/1200x630.png`,
        width: 1200,
        height: 630,
        alt: "CoinRisqLab Methodology",
      },
    ],
  },
};

export default function MethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
