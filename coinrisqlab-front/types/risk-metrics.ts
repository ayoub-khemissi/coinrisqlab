/**
 * Risk Metrics Types
 * Types for the 7 risk panels in crypto detail page
 */

/**
 * Panel identifier for navigation
 */
export type RiskPanel =
  | "price"
  | "volatility"
  | "stress-test"
  | "var"
  | "var"
  | "beta"
  | "skew"
  | "kurtosis"
  | "sml";

/**
 * Period for risk calculations
 */
export type RiskPeriod = "7d" | "30d" | "90d" | "365d" | "all";

/**
 * Basic crypto info returned with each endpoint
 */
export interface CryptoInfo {
  id: number;
  symbol: string;
  name: string;
}

// ============================================================================
// PRICE HISTORY
// ============================================================================

export interface PricePoint {
  date: string;
  price: number;
}

export interface PriceChanges {
  "1h": number | null;
  "24h": number | null;
  "7d": number | null;
  "30d": number | null;
}

export interface PriceHistoryData {
  crypto: CryptoInfo;
  prices: PricePoint[];
  current: {
    price: number;
    changes: PriceChanges;
  } | null;
  period: string;
  dataPoints: number;
}

export interface PriceHistoryResponse {
  data: PriceHistoryData;
}

// ============================================================================
// BETA
// ============================================================================

export interface ScatterPoint {
  date: string;
  marketReturn: number;
  cryptoReturn: number;
}

export interface RegressionLine {
  slope: number;
  intercept: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BetaData {
  crypto: CryptoInfo;
  beta: number | null;
  alpha: number | null;
  rSquared: number | null;
  correlation: number | null;
  scatterData: ScatterPoint[];
  regressionLine?: RegressionLine;
  period: string;
  dataPoints: number;
  fromHistorized?: boolean;
  msg?: string;
}

export interface BetaResponse {
  data: BetaData;
}

// ============================================================================
// VAR (VALUE AT RISK)
// ============================================================================

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  binCenter: number;
  count: number;
  percentage: number;
}

export interface VaRStatistics {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface VaRData {
  crypto: CryptoInfo;
  var95: number | null;
  var99: number | null;
  cvar95: number | null;
  cvar99: number | null;
  histogram: HistogramBin[] | null;
  statistics?: VaRStatistics;
  period: string;
  dataPoints: number;
  fromHistorized?: boolean;
  msg?: string;
}

export interface VaRResponse {
  data: VaRData;
}

// ============================================================================
// STRESS TEST
// ============================================================================

/**
 * Historical crisis scenario identifier
 */
export type StressScenarioId =
  | "covid-19"
  | "china-mining-ban"
  | "ust-crash"
  | "ftx-crash";

/**
 * Stress scenario with historical data
 */
export interface StressScenario {
  id: StressScenarioId;
  name: string;
  marketShock: number;
  expectedImpact: number;
  newPrice: number;
  priceChange: number;
  startDate: string;
  endDate: string;
  description: string;
}

/**
 * Price point for stress test chart
 */
export interface StressPricePoint {
  date: string;
  price: number;
}

export interface StressTestData {
  crypto: CryptoInfo;
  currentPrice: number;
  beta: number;
  scenarios: StressScenario[];
  priceHistory: StressPricePoint[];
  period: string;
  dataPoints: number;
}

export interface StressTestResponse {
  data: StressTestData;
}

/**
 * Scenario display configuration
 */
export const STRESS_SCENARIO_COLORS: Record<StressScenarioId, string> = {
  "covid-19": "#ef4444",
  "china-mining-ban": "#f97316",
  "ust-crash": "#eab308",
  "ftx-crash": "#8b5cf6",
};

// ============================================================================
// DISTRIBUTION (SKEWNESS / KURTOSIS)
// ============================================================================

export interface DistributionHistogramBin {
  binStart: number;
  binEnd: number;
  binCenter: number;
  count: number;
  density: number;
  normalDensity: number;
}

export interface NormalCurvePoint {
  x: number;
  y: number;
}

export interface DistributionInterpretation {
  skewness: "negative" | "positive" | "symmetric";
  kurtosis: "leptokurtic" | "platykurtic" | "mesokurtic";
}

export interface DistributionData {
  crypto: CryptoInfo;
  skewness: number | null;
  kurtosis: number | null;
  mean: number;
  stdDev: number;
  histogram: DistributionHistogramBin[] | null;
  normalCurve: NormalCurvePoint[] | null;
  interpretation?: DistributionInterpretation;
  period: string;
  dataPoints: number;
  fromHistorized?: boolean;
  msg?: string;
}

export interface DistributionResponse {
  data: DistributionData;
}

// ============================================================================
// SML (SECURITY MARKET LINE)
// ============================================================================

export interface SMLLinePoint {
  beta: number;
  expectedReturn: number;
}

export interface SMLData {
  crypto: CryptoInfo;
  cryptoBeta: number;
  cryptoExpectedReturn: number;
  cryptoActualReturn: number;
  alpha: number;
  isOvervalued: boolean;
  smlLine: SMLLinePoint[];
  marketReturn: number;
  period: string;
  dataPoints: number;
  fromHistorized?: boolean;
  msg?: string;
}

export interface SMLResponse {
  data: SMLData | null;
}

// ============================================================================
// RISK SUMMARY (Combined metrics)
// ============================================================================

export interface RiskSummaryData {
  crypto: CryptoInfo;
  hasData: boolean;
  price: {
    current: number;
    changes: PriceChanges;
  } | null;
  volatility: {
    daily: number;
    annualized: number;
    changes: {
      "24h": number | null;
      "7d": number | null;
      "30d": number | null;
      "90d": number | null;
    } | null;
  } | null;
  beta: number | null;
  alpha: number | null;
  sml: {
    alpha: number;
    isOvervalued: boolean;
  } | null;
  var95: number | null;
  var99: number | null;
  cvar99: number | null;
  stressTest: {
    newPrice: number;
    priceChange: number;
    impactPercentage: number;
  } | null;
  skewness: number | null;
  kurtosis: number | null;
  period: string;
  dataPoints: number;
  msg?: string;
}

export interface RiskSummaryResponse {
  data: RiskSummaryData;
}

// ============================================================================
// PANEL CONFIGURATION
// ============================================================================

export interface PanelConfig {
  id: RiskPanel;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

export const PANEL_CONFIGS: PanelConfig[] = [
  {
    id: "price",
    label: "Price",
    shortLabel: "Price",
    description: "Price evolution and variations",
    icon: "dollar-sign",
  },
  {
    id: "volatility",
    label: "Volatility",
    shortLabel: "Vol.",
    description: "Daily and annualized volatility",
    icon: "activity",
  },
  {
    id: "stress-test",
    label: "Stress Test",
    shortLabel: "Stress",
    description: "Historical crisis scenarios (Covid-19, FTX, etc.)",
    icon: "alert-triangle",
  },
  {
    id: "var",
    label: "Value at Risk",
    shortLabel: "VaR",
    description: "Potential loss at 95% and 99%",
    icon: "shield",
  },
  {
    id: "beta",
    label: "Beta",
    shortLabel: "Beta",
    description: "Market sensitivity (Beta, Alpha, R²)",
    icon: "trending-up",
  },
  {
    id: "skew",
    label: "Skewness",
    shortLabel: "Skew",
    description: "Asymmetry of returns distribution",
    icon: "bar-chart-2",
  },
  {
    id: "kurtosis",
    label: "Kurtosis",
    shortLabel: "Kurtosis",
    description: "Tail risk and extreme values",
    icon: "bar-chart-vertical",
  },
  {
    id: "sml",
    label: "SML",
    shortLabel: "SML",
    description: "Security Market Line",
    icon: "git-branch",
  },
];

// ============================================================================
// BETA INTERPRETATION HELPERS
// ============================================================================

export type BetaCategory =
  | "inverse"
  | "uncorrelated"
  | "defensive"
  | "market"
  | "aggressive"
  | "highly-volatile"
  | "speculative";

export interface BetaInterpretation {
  category: BetaCategory;
  label: string;
  description: string;
  color: "success" | "warning" | "danger" | "default" | "primary";
}

export function getBetaInterpretation(beta: number): BetaInterpretation {
  if (beta < 0) {
    return {
      category: "inverse",
      label: "Inverse",
      description: "Moves opposite to the market",
      color: "primary",
    };
  }
  if (beta === 0) {
    return {
      category: "uncorrelated",
      label: "Uncorrelated",
      description: "Independent of market",
      color: "default",
    };
  }
  if (beta < 1) {
    return {
      category: "defensive",
      label: "Defensive",
      description: "Less volatile than market",
      color: "success",
    };
  }
  if (beta === 1) {
    return {
      category: "market",
      label: "Market-Indexed",
      description: "Moves like the market",
      color: "default",
    };
  }
  if (beta < 2) {
    return {
      category: "aggressive",
      label: "Aggressive",
      description: "Amplifies market movements",
      color: "warning",
    };
  }
  if (beta === 2) {
    return {
      category: "highly-volatile",
      label: "Highly Volatile",
      description: "2x market movements",
      color: "danger",
    };
  }

  return {
    category: "speculative",
    label: "Speculative",
    description: "Extreme sensitivity to market",
    color: "danger",
  };
}

// ============================================================================
// SKEWNESS / KURTOSIS INTERPRETATION HELPERS
// ============================================================================

export interface SkewnessInterpretation {
  type: "negative" | "symmetric" | "positive";
  label: string;
  description: string;
  color: "success" | "warning" | "danger" | "default" | "primary";
}

export function getSkewnessInterpretation(
  skewness: number,
): SkewnessInterpretation {
  if (skewness < -0.5) {
    return {
      type: "negative",
      label: "Negative Skew",
      description: "More extreme losses than gains (left tail)",
      color: "danger",
    };
  }
  if (skewness > 0.5) {
    return {
      type: "positive",
      label: "Positive Skew",
      description: "More extreme gains than losses (right tail)",
      color: "success",
    };
  }

  return {
    type: "symmetric",
    label: "Symmetric",
    description: "Balanced distribution of returns",
    color: "default",
  };
}

export interface KurtosisInterpretation {
  type: "leptokurtic" | "mesokurtic" | "platykurtic";
  label: string;
  description: string;
  color: "success" | "warning" | "danger" | "default" | "primary";
}

export function getKurtosisInterpretation(
  kurtosis: number,
): KurtosisInterpretation {
  if (kurtosis > 1) {
    return {
      type: "leptokurtic",
      label: "Fat Tails",
      description: "Higher probability of extreme events",
      color: "warning",
    };
  }
  if (kurtosis < -1) {
    return {
      type: "platykurtic",
      label: "Thin Tails",
      description: "Lower probability of extreme events",
      color: "success",
    };
  }

  return {
    type: "mesokurtic",
    label: "Normal Tails",
    description: "Similar to normal distribution",
    color: "default",
  };
}
