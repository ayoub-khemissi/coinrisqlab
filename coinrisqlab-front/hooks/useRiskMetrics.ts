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
export function usePriceHistory(symbol: string, period: RiskPeriod = "90d") {
  const [data, setData] = useState<PriceHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${symbol}/price-history?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch price history for ${symbol}`);
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
  }, [symbol, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch beta data
 */
export function useBeta(symbol: string, period: RiskPeriod = "365d") {
  const [data, setData] = useState<BetaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${symbol}/beta?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch beta for ${symbol}`);
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
  }, [symbol, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch VaR data
 */
export function useVaR(symbol: string, period: RiskPeriod = "365d") {
  const [data, setData] = useState<VaRData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${symbol}/var?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch VaR for ${symbol}`);
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
  }, [symbol, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch stress test data
 */
export function useStressTest(symbol: string) {
  const [data, setData] = useState<StressTestData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!symbol) {
      setData(null);

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/risk/crypto/${symbol}/stress-test`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch stress test for ${symbol}`);
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
  }, [symbol]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook to fetch distribution (skewness/kurtosis) data
 */
export function useDistribution(symbol: string, period: RiskPeriod = "90d") {
  const [data, setData] = useState<DistributionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${symbol}/distribution?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch distribution for ${symbol}`);
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
  }, [symbol, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch SML data
 */
export function useSML(symbol: string, period: RiskPeriod = "90d") {
  const [data, setData] = useState<SMLData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${symbol}/sml?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch SML for ${symbol}`);
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
  }, [symbol, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch risk summary (all metrics combined)
 */
export function useRiskSummary(symbol: string, period: RiskPeriod = "90d") {
  const [data, setData] = useState<RiskSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData(null);

      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/risk/crypto/${symbol}/summary?period=${period}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch risk summary for ${symbol}`);
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
  }, [symbol, period]);

  return { data, isLoading, error };
}
