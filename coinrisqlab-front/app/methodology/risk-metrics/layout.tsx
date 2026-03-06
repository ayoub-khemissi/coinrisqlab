import { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Risk Metrics Methodology",
  description:
    "Complete methodology for CoinRisqLab risk metrics: Value at Risk (VaR), Conditional VaR (CVaR), Beta, Alpha, Sharpe Ratio, Security Market Line, Skewness, Kurtosis, and stress testing.",
  alternates: {
    canonical: `${siteConfig.siteUrl}/methodology/risk-metrics`,
  },
  openGraph: {
    title: "Risk Metrics Methodology | CoinRisqLab",
    description:
      "How CoinRisqLab calculates VaR, CVaR, Beta, Alpha, Sharpe Ratio, and other crypto risk metrics.",
    url: `${siteConfig.siteUrl}/methodology/risk-metrics`,
  },
};

export default function RiskMetricsMethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
