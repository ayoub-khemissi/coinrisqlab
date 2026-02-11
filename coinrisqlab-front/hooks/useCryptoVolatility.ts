import { useState, useEffect } from "react";

import { API_BASE_URL } from "@/config/constants";
import { CryptoVolatilityResponse, VolatilityPeriod } from "@/types/volatility";

interface ComparisonData {
  coingeckoId: string;
  data: CryptoVolatilityResponse["data"];
  color: string;
}

const COLORS = [
  "#54bcf0", // Sky Blue
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f97316", // Orange
  "#14b8a6", // Teal
];

export function useCryptoVolatility(
  coingeckoIds: string[],
  period: VolatilityPeriod = "90d",
) {
  const [data, setData] = useState<ComparisonData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a stable string key from coingeckoIds array
  const idsKey = coingeckoIds.join(",");

  useEffect(() => {
    // Parse the key back to array to avoid using the original reference
    const idsList = idsKey ? idsKey.split(",") : [];

    if (idsList.length === 0) {
      setData([]);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const promises = idsList.map(async (coingeckoId, index) => {
          const response = await fetch(
            `${API_BASE_URL}/volatility/crypto/${coingeckoId}?period=${period}`,
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch volatility for ${coingeckoId}`);
          }

          const result: CryptoVolatilityResponse = await response.json();

          return {
            coingeckoId,
            data: result.data,
            color: COLORS[index % COLORS.length],
          };
        });

        const results = await Promise.all(promises);

        setData(results);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [idsKey, period]);

  return { data, isLoading, error };
}
