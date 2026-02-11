import { useState, useEffect } from "react";

import { API_BASE_URL } from "@/config/constants";
import { CryptoVolatilityResponse, VolatilityPeriod } from "@/types/volatility";

interface ComparisonData {
  symbol: string;
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
  symbols: string[],
  period: VolatilityPeriod = "90d",
) {
  const [data, setData] = useState<ComparisonData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create a stable string key from symbols array
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    // Parse the key back to array to avoid using the original symbols reference
    const symbolsList = symbolsKey ? symbolsKey.split(",") : [];

    if (symbolsList.length === 0) {
      setData([]);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const promises = symbolsList.map(async (symbol, index) => {
          const response = await fetch(
            `${API_BASE_URL}/volatility/crypto/${symbol}?period=${period}`,
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch volatility for ${symbol}`);
          }

          const result: CryptoVolatilityResponse = await response.json();

          return {
            symbol,
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
  }, [symbolsKey, period]);

  return { data, isLoading, error };
}
