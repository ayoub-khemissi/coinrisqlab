import { Metadata } from "next";

import CryptoDetailContent from "./content";

import { API_BASE_URL } from "@/config/constants";
import { CryptoDetailResponse } from "@/types/crypto-detail";

type Props = {
  params: Promise<{ symbol: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;

  try {
    const response = await fetch(
      `${API_BASE_URL}/cryptocurrency/${symbol.toUpperCase()}`,
    );

    if (!response.ok) {
      return {
        title: `${symbol.toUpperCase()} | CoinRisqLab`,
      };
    }

    const result: CryptoDetailResponse = await response.json();
    const { basic } = result.data;

    return {
      title: `${basic.name} (${basic.symbol})`,
    };
  } catch {
    return {
      title: `${symbol.toUpperCase()} | CoinRisqLab`,
    };
  }
}

export default function CryptoDetailPage() {
  return <CryptoDetailContent />;
}
