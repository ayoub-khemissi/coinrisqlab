import { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { API_BASE_URL } from "@/config/constants";

type Cryptocurrency = {
  symbol: string;
  last_updated: string;
};

type CryptocurrencyResponse = {
  data: Cryptocurrency[];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = [
    "",
    "/index-coinrisqlab",
    "/methodology",
    "/methodology/index-coinrisqlab",
    "/portfolio-risk",
  ].map((route) => ({
    url: `${siteConfig.siteUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  try {
    const response = await fetch(
      `${API_BASE_URL}/cryptocurrencies?page=1&limit=100`,
    );
    const result: CryptocurrencyResponse = await response.json();

    const cryptoRoutes = result.data.map((crypto) => ({
      url: `${siteConfig.siteUrl}/crypto/${crypto.symbol.toLowerCase()}`,
      lastModified: new Date().toISOString(),
      changeFrequency: "hourly" as const,
      priority: 0.6,
    }));

    return [...routes, ...cryptoRoutes];
  } catch {
    return routes;
  }
}
