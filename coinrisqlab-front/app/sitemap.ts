import { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { API_BASE_URL } from "@/config/constants";

type Cryptocurrency = {
  coingecko_id: string;
  symbol: string;
  last_updated: string;
};

type CryptocurrencyResponse = {
  data: Cryptocurrency[];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    { path: "", priority: 1, changeFrequency: "daily" as const },
    {
      path: "/index-coinrisqlab",
      priority: 0.9,
      changeFrequency: "daily" as const,
    },
    {
      path: "/market-volatility",
      priority: 0.9,
      changeFrequency: "daily" as const,
    },
    {
      path: "/methodology",
      priority: 0.8,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/methodology/index-coinrisqlab",
      priority: 0.7,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/methodology/volatility",
      priority: 0.7,
      changeFrequency: "monthly" as const,
    },
    {
      path: "/methodology/risk-metrics",
      priority: 0.7,
      changeFrequency: "monthly" as const,
    },
  ].map((route) => ({
    url: `${siteConfig.siteUrl}${route.path}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const response = await fetch(
      `${API_BASE_URL}/cryptocurrencies?page=1&limit=100`,
    );
    const result: CryptocurrencyResponse = await response.json();

    const cryptoRoutes = result.data.map((crypto) => ({
      url: `${siteConfig.siteUrl}/crypto/${crypto.coingecko_id}`,
      lastModified: new Date().toISOString(),
      changeFrequency: "hourly" as const,
      priority: 0.6,
    }));

    return [...routes, ...cryptoRoutes];
  } catch {
    return routes;
  }
}
