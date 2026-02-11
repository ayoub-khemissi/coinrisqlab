/**
 * Portfolio Volatility Types
 * Based on the backend portfolio_volatility table
 */
export interface PortfolioVolatility {
  id: number;
  index_config_id: number;
  date: string;
  window_days: number;
  daily_volatility: number;
  annualized_volatility: number;
  num_constituents: number;
  total_market_cap_usd: number;
  calculation_duration_ms: number;
  created_at?: string;
  index_name?: string;
}

/**
 * Portfolio Volatility Constituent
 * Represents individual crypto volatility within the portfolio
 */
export interface PortfolioVolatilityConstituent {
  crypto_id: number;
  symbol: string;
  name: string;
  image_url: string | null;
  weight: number;
  daily_volatility: number;
  annualized_volatility: number;
  market_cap_usd: number;
  available_days?: number; // Only present for excluded constituents (insufficient data)
}

/**
 * API Response for Portfolio Volatility
 */
export interface PortfolioVolatilityResponse {
  data: {
    current: PortfolioVolatility | null;
    history: PortfolioVolatility[];
  };
}

/**
 * API Response for Portfolio Constituents Volatility
 */
export interface PortfolioConstituentsVolatilityResponse {
  data: PortfolioVolatilityConstituent[];
}

/**
 * Individual Crypto Volatility
 */
export interface CryptoVolatility {
  id: number;
  crypto_id: number;
  date: string;
  window_days: number;
  daily_volatility: number;
  annualized_volatility: number;
  num_observations: number;
  mean_return: number;
  created_at?: string;
}

/**
 * API Response for Individual Crypto Volatility
 */
export interface CryptoVolatilityResponse {
  data: {
    crypto: {
      id: number;
      symbol: string;
      name: string;
    };
    latest: CryptoVolatility | null;
    history: CryptoVolatility[];
  };
}

/**
 * Top Volatile Crypto
 */
export interface TopVolatileCrypto {
  id: number;
  symbol: string;
  name: string;
  image_url: string | null;
  annualized_volatility: number;
  date: string;
}

/**
 * Risk Level Classification
 */
export type RiskLevel = "low" | "medium" | "high" | "extreme";

/**
 * Period for volatility data
 */
export type VolatilityPeriod = "24h" | "7d" | "30d" | "90d" | "365d" | "all";

/**
 * Diversification Benefit Calculation
 */
export interface DiversificationBenefit {
  portfolioVolatility: number;
  weightedAverageVolatility: number;
  benefitPercentage: number;
  benefitAbsolute: number;
}

/**
 * Risk Contribution
 * How much each constituent contributes to portfolio risk
 */
export interface RiskContribution extends PortfolioVolatilityConstituent {
  riskContribution: number; // weight × volatility
  riskContributionPercentage: number; // % of total risk
}

/**
 * API Response for Correlation
 */
export interface CorrelationResponse {
  data: {
    correlation: number;
    symbol1: string;
    symbol2: string;
    period: string;
    dataPoints: number;
    msg?: string;
  };
}
