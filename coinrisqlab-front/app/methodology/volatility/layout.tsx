import { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Volatility Calculation Methodology",
  description:
    "How CoinRisqLab measures crypto market risk through volatility: logarithmic returns, rolling windows, covariance matrices, portfolio-level volatility, and diversification benefit calculation.",
  alternates: {
    canonical: `${siteConfig.siteUrl}/methodology/volatility`,
  },
  openGraph: {
    title: "Volatility Calculation Methodology | CoinRisqLab",
    description:
      "Mathematical methodology behind CoinRisqLab volatility: log returns, covariance matrices, and diversification.",
    url: `${siteConfig.siteUrl}/methodology/volatility`,
  },
};

export default function VolatilityMethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
