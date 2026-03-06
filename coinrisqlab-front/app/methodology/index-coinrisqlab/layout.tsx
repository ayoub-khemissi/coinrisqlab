import { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Index Calculation Methodology",
  description:
    "Detailed methodology for the CoinRisqLab 80 Index: market-cap weighting formula, constituent selection criteria, rebalancing rules, and worked calculation examples.",
  alternates: {
    canonical: `${siteConfig.siteUrl}/methodology/index-coinrisqlab`,
  },
  openGraph: {
    title: "Index Calculation Methodology | CoinRisqLab",
    description:
      "How the CoinRisqLab 80 Index is calculated: weighting, selection criteria, and rebalancing.",
    url: `${siteConfig.siteUrl}/methodology/index-coinrisqlab`,
  },
};

export default function IndexMethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
