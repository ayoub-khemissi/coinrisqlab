import { Metadata } from "next";

import CryptoDetailContent from "./content";

import { API_BASE_URL } from "@/config/constants";
import { siteConfig } from "@/config/site";
import { CryptoDetailResponse } from "@/types/crypto-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const response = await fetch(`${API_BASE_URL}/cryptocurrency/${id}`);

    if (!response.ok) {
      return {
        title: `${id} | CoinRisqLab`,
      };
    }

    const result: CryptoDetailResponse = await response.json();
    const { basic } = result.data;

    const title = `${basic.name} (${basic.symbol}) Risk Analytics & Price`;
    const description = `Real-time ${basic.name} (${basic.symbol}) analytics: live price, volatility, VaR, Beta, Sharpe Ratio, stress tests, and risk profile. Data updated every hour on CoinRisqLab.`;

    return {
      title,
      description,
      alternates: {
        canonical: `${siteConfig.siteUrl}/crypto/${id}`,
      },
      openGraph: {
        title: `${title} | CoinRisqLab`,
        description,
        url: `${siteConfig.siteUrl}/crypto/${id}`,
        images: basic.image_url
          ? [
              {
                url: basic.image_url,
                width: 200,
                height: 200,
                alt: `${basic.name} logo`,
              },
            ]
          : undefined,
      },
    };
  } catch {
    return {
      title: `${id} | CoinRisqLab`,
    };
  }
}

export default function CryptoDetailPage() {
  return <CryptoDetailContent />;
}
