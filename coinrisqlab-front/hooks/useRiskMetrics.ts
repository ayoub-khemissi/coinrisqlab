import { useState, useEffect, useCallback } from "react";

import { API_BASE_URL } from "@/config/constants";
import {
  BetaData,
  BetaResponse,
  DistributionData,
  DistributionResponse,
  PriceHistoryData,
  PriceHistoryResponse,
  RiskPeriod,
  RiskSummaryData,
  RiskSummaryResponse,
  SMLData,
  SMLResponse,
  StressTestData,
  StressTestResponse,
  VaRData,
  VaRResponse,
} from "@/types/risk-metrics";

/**
 * Hook to fetch price history data
 */
export function usePriceHistory(
  coingeckoId: string,
  period: RiskPeriod = "90d",
) {
  const [data, setData] = useState<PriceHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!coingeckoId) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${coingeckoId}/price-history?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch price history for ${coingeckoId}`);
        }

        const result: PriceHistoryResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [coingeckoId, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch beta data
 */
export function useBeta(coingeckoId: string, period: RiskPeriod = "365d") {
  const [data, setData] = useState<BetaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!coingeckoId) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${coingeckoId}/beta?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch beta for ${coingeckoId}`);
        }

        const result: BetaResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [coingeckoId, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch VaR data
 */
export function useVaR(coingeckoId: string, period: RiskPeriod = "365d") {
  const [data, setData] = useState<VaRData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!coingeckoId) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${coingeckoId}/var?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch VaR for ${coingeckoId}`);
        }

        const result: VaRResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [coingeckoId, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch stress test data
 */
export function useStressTest(coingeckoId: string) {
  const [data, setData] = useState<StressTestData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!coingeckoId) {
      setData(null);

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/risk/crypto/${coingeckoId}/stress-test`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch stress test for ${coingeckoId}`);
      }

      const result: StressTestResponse = await response.json();

      setData(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [coingeckoId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook to fetch distribution (skewness/kurtosis) data
 */
export function useDistribution(
  coingeckoId: string,
  period: RiskPeriod = "90d",
) {
  const [data, setData] = useState<DistributionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!coingeckoId) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${coingeckoId}/distribution?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch distribution for ${coingeckoId}`);
        }

        const result: DistributionResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [coingeckoId, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch SML data
 */
export function useSML(coingeckoId: string, period: RiskPeriod = "90d") {
  const [data, setData] = useState<SMLData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!coingeckoId) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${coingeckoId}/sml?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch SML for ${coingeckoId}`);
        }

        const result: SMLResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [coingeckoId, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch risk summary (all metrics combined)
 */
export function useRiskSummary(
  coingeckoId: string,
  period: RiskPeriod = "90d",
) {
  const [data, setData] = useState<RiskSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!coingeckoId) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${coingeckoId}/summary?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch risk summary for ${coingeckoId}`);
        }

        const result: RiskSummaryResponse = await response.json();

        setData(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred"),
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [coingeckoId, period]);

  return { data, isLoading, error };
}
