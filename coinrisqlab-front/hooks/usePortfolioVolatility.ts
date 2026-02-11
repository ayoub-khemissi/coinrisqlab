import { useState, useEffect } from "react";

import { API_BASE_URL } from "@/config/constants";
import {
  PortfolioVolatilityResponse,
  PortfolioConstituentsVolatilityResponse,
  VolatilityPeriod,
  DiversificationBenefit,
  RiskContribution,
  CorrelationResponse,
} from "@/types/volatility";

/**
 * Hook to fetch correlation between two cryptocurrencies
 * @param symbol1 - First crypto symbol
 * @param symbol2 - Second crypto symbol
 * @param period - Time period for historical data
 * @returns Correlation data, loading state, and error
 */
export function useCorrelation(
  symbol1: string,
  symbol2: string,
  period: VolatilityPeriod = "90d",
) {
  const [data, setData] = useState<CorrelationResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol1 || !symbol2) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/volatility/correlation?symbol1=${symbol1}&symbol2=${symbol2}&period=${period}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch correlation data");
        }

        const result: CorrelationResponse = await response.json();

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
  }, [symbol1, symbol2, period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch portfolio volatility data
 * @param period - Time period for historical data
 * @returns Portfolio volatility data, loading state, and error
 */
export function usePortfolioVolatility(period: VolatilityPeriod = "all") {
  const [data, setData] = useState<PortfolioVolatilityResponse["data"] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/volatility/portfolio?period=${period}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch portfolio volatility");
        }

        const result: PortfolioVolatilityResponse = await response.json();

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
  }, [period]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch portfolio volatility constituents
 * @returns Portfolio constituents with their volatility data
 */
export function usePortfolioConstituentsVolatility() {
  const [data, setData] = useState<
    PortfolioConstituentsVolatilityResponse["data"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/volatility/portfolio/constituents`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch portfolio constituents volatility");
        }

        const result: PortfolioConstituentsVolatilityResponse =
          await response.json();

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
  }, []);

  return { data, isLoading, error };
}

/**
 * Calculate diversification benefit
 * @param portfolioVol - Portfolio volatility
 * @param constituents - Array of constituents with weights and volatilities
 * @returns Diversification benefit calculation
 */
export function calculateDiversificationBenefit(
  portfolioVol: number,
  constituents: Array<{ weight: number; annualized_volatility: number }>,
): DiversificationBenefit {
  // Calculate weighted average volatility
  const weightedAverageVolatility = constituents.reduce(
    (sum, constituent) =>
      sum + constituent.weight * constituent.annualized_volatility,
    0,
  );

  // Calculate benefit
  const benefitAbsolute = weightedAverageVolatility - portfolioVol;
  const benefitPercentage =
    weightedAverageVolatility > 0
      ? (benefitAbsolute / weightedAverageVolatility) * 100
      : 0;

  return {
    portfolioVolatility: portfolioVol,
    weightedAverageVolatility,
    benefitAbsolute,
    benefitPercentage,
  };
}

/**
 * Calculate risk contribution for each constituent
 * @param constituents - Array of constituents with weights and volatilities
 * @returns Array of risk contributions
 */
export function calculateRiskContributions(
  constituents: Array<{
    crypto_id: number;
    symbol: string;
    name: string;
    image_url: string | null;
    weight: number;
    daily_volatility: number;
    annualized_volatility: number;
    market_cap_usd: number;
  }>,
): RiskContribution[] {
  // Calculate total risk (sum of weight × volatility)
  const totalRisk = constituents.reduce(
    (sum, c) => sum + c.weight * c.annualized_volatility,
    0,
  );

  return constituents.map((constituent) => {
    const riskContribution =
      constituent.weight * constituent.annualized_volatility;
    const riskContributionPercentage =
      totalRisk > 0 ? (riskContribution / totalRisk) * 100 : 0;

    return {
      ...constituent,
      riskContribution,
      riskContributionPercentage,
    };
  });
}

/**
 * Determine risk level based on annualized volatility
 * @param volatility - Annualized volatility (as decimal, e.g., 0.45 for 45%)
 * @returns Risk level classification
 */
export function getRiskLevel(
  volatility: number,
): "low" | "medium" | "high" | "extreme" {
  const volPercentage = volatility * 100;

  if (volPercentage < 10) return "low";
  if (volPercentage < 30) return "medium";
  if (volPercentage < 60) return "high";

  return "extreme";
}

/**
 * Get color for risk level
 * @param level - Risk level
 * @returns HeroUI color
 */
export function getRiskLevelColor(
  level: "low" | "medium" | "high" | "extreme",
): "success" | "warning" | "danger" | "default" {
  switch (level) {
    case "low":
      return "success"; // Green (< 10%)
    case "medium":
      return "warning"; // Yellow (10-30%)
    case "high":
      return "warning"; // Orange (30-60%) - Note: HeroUI has no native orange, uses warning
    case "extreme":
      return "danger"; // Red (≥ 60%)
    default:
      return "default";
  }
}

/**
 * Get color class for risk level
 * @param level - Risk level
 * @returns Tailwind color class
 */
export function getRiskLevelColorClass(
  level: "low" | "medium" | "high" | "extreme",
): string {
  switch (level) {
    case "low":
      return "text-success";
    case "medium":
      return "text-warning";
    case "high":
      return "text-orange-500";
    case "extreme":
      return "text-danger";
    default:
      return "text-default";
  }
}
