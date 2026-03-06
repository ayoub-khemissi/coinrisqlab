import { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Branding Assets",
  description:
    "Official CoinRisqLab branding assets, presentation cards, and Open Graph images for media and partner use.",
  alternates: {
    canonical: `${siteConfig.siteUrl}/branding`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function BrandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
